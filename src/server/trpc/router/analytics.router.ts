import z from "zod";

import StatusSchema, { type StatusType } from "@/generated/zod/inputTypeSchemas/StatusSchema";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

const LanguageMetricSchema = z.object({
  color: z.string(),
  lines: z.number(),
  name: z.string(),
});

const MetricsJsonSchema = z.object({
  languages: z.array(LanguageMetricSchema).optional(),
  totalLoc: z.number().optional(),
});

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure
    .meta({
      openapi: {
        description: "Returns aggregated metrics, global scores, and language distribution.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/analytics",
        protect: true,
        summary: "Get rich dashboard statistics",
        tags: ["analytics"],
      },
    })
    .input(z.void())
    .output(
      z.object({
        analysisStats: z.object({
          failed: z.number(),
          pending: z.number(),
          success: z.number(),
          total: z.number(),
        }),
        highlights: z.object({
          mostCritical: z.object({ name: z.string(), score: z.number() }).nullable(),
          topPerformer: z.object({ name: z.string(), score: z.number() }).nullable(),
        }),
        languages: z.array(
          z.object({
            color: z.string(),
            name: z.string(),
            value: z.number(),
          })
        ),
        overview: z.object({
          avgComplexityScore: z.number(),
          avgHealthScore: z.number(),
          avgOnboardingScore: z.number(),
          avgSecurityScore: z.number(),
          avgTechDebtScore: z.number(),
          criticalRepoCount: z.number(),
          docsCount: z.number(),
          repoCount: z.number(),
          totalLoc: z.number(),
        }),
        recentActivity: z.array(
          z.object({
            createdAt: z.date(),
            id: z.string(),
            progress: z.number(),
            repoName: z.string(),
            repoOwner: z.string(),
            status: StatusSchema,
          })
        ),
      })
    )
    .query(async ({ ctx }) => {
      const [
        repoCount,
        docsCount,
        analysisStats,
        aggregates,
        recentAnalyses,
        reposWithMetrics,
        worstRepo,
        bestRepo,
        criticalRepoCount,
      ] = await Promise.all([
        ctx.db.repo.count(),

        ctx.db.document.count(),

        ctx.db.analysis.groupBy({
          _count: { status: true },
          by: ["status"],
        }),

        ctx.db.analysis.aggregate({
          _avg: {
            complexityScore: true,
            onboardingScore: true,
            score: true,
            securityScore: true,
            techDebtScore: true,
          },
          where: { status: "DONE" },
        }),

        ctx.db.analysis.findMany({
          include: { repo: { select: { name: true, owner: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),

        ctx.db.repo.findMany({
          select: {
            analyses: {
              orderBy: { createdAt: "desc" },
              select: { metricsJson: true },
              take: 1,
              where: { status: "DONE" },
            },
          },
        }),
        ctx.db.analysis.findFirst({
          orderBy: { score: "asc" },
          select: { repo: { select: { name: true } }, score: true },
          where: { score: { gt: 0, lt: 50 }, status: "DONE" },
        }),

        ctx.db.analysis.findFirst({
          orderBy: { score: "desc" },
          select: { repo: { select: { name: true } }, score: true },
          where: { status: "DONE" },
        }),
        ctx.db.repo.count({
          where: {
            analyses: {
              some: {
                score: { gt: 0, lt: 50 },
                status: "DONE",
              },
            },
          },
        }),
      ]);

      const statsMap = analysisStats.reduce(
        (acc, curr) => {
          acc[curr.status] = curr._count.status;
          return acc;
        },
        {} as Record<string, number>
      );

      const langMap = new Map<string, { color: string; lines: number }>();
      let globalTotalLoc = 0;

      reposWithMetrics.forEach((repo) => {
        const metrics = repo.analyses[0]?.metricsJson;
        if (metrics == null) return;

        const parsed = MetricsJsonSchema.safeParse(metrics);
        if (parsed.success) {
          globalTotalLoc += parsed.data.totalLoc ?? 0;
          parsed.data.languages?.forEach((lang) => {
            const current = langMap.get(lang.name) || { color: lang.color, lines: 0 };
            langMap.set(lang.name, {
              color: lang.color,
              lines: current.lines + lang.lines,
            });
          });
        }
      });

      const sortedLanguages = Array.from(langMap.entries())
        .map(([name, data]) => ({ color: data.color, name, value: data.lines }))
        .sort((a, b) => b.value - a.value);

      const topLanguages = sortedLanguages.slice(0, 5);
      const otherLines = sortedLanguages.slice(5).reduce((acc, curr) => acc + curr.value, 0);

      if (otherLines > 0) {
        topLanguages.push({ color: "#808080", name: "Other", value: otherLines });
      }

      return {
        analysisStats: {
          failed: statsMap["FAILED"] ?? 0,
          pending: (statsMap["PENDING"] ?? 0) + (statsMap["NEW"] ?? 0),
          success: statsMap["DONE"] ?? 0,
          total: Object.values(statsMap).reduce((a, b) => a + b, 0),
        },
        highlights: {
          mostCritical:
            worstRepo != null ? { name: worstRepo.repo.name, score: worstRepo.score ?? 0 } : null,
          topPerformer:
            bestRepo != null ? { name: bestRepo.repo.name, score: bestRepo.score ?? 0 } : null,
        },
        languages: topLanguages,
        overview: {
          avgComplexityScore: Math.round(aggregates._avg.complexityScore ?? 0),
          avgHealthScore: Math.round(aggregates._avg.score ?? 0),
          avgOnboardingScore: Math.round(aggregates._avg.onboardingScore ?? 0),
          avgSecurityScore: Math.round(aggregates._avg.securityScore ?? 0),
          avgTechDebtScore: Math.round(aggregates._avg.techDebtScore ?? 0),
          criticalRepoCount,
          docsCount,
          repoCount,
          totalLoc: globalTotalLoc,
        },
        recentActivity: recentAnalyses.map((a) => ({
          createdAt: a.createdAt,
          id: a.publicId,
          progress: a.progress,
          repoName: a.repo.name,
          repoOwner: a.repo.owner,
          status: a.status as StatusType,
        })),
      };
    }),
  getTrends: protectedProcedure
    .output(
      z.array(
        z.object({
          complexity: z.number(),
          date: z.string(),
          fullDate: z.string(),
          health: z.number(),
          onboarding: z.number(),
          security: z.number(),
          techDebt: z.number(),
        })
      )
    )
    .query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const analyses = await ctx.db.analysis.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          complexityScore: true,
          createdAt: true,
          onboardingScore: true,
          score: true,
          securityScore: true,
          techDebtScore: true,
        },
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: "DONE",
        },
      });

      const grouped = new Map<
        string,
        {
          compSum: number;
          count: number;
          debtSum: number;
          healthSum: number;
          onbSum: number;
          secSum: number;
        }
      >();

      analyses.forEach((a) => {
        const dateKey = new Intl.DateTimeFormat("en-US", {
          day: "numeric",
          month: "short",
        }).format(a.createdAt);

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            compSum: 0,
            count: 0,
            debtSum: 0,
            healthSum: 0,
            onbSum: 0,
            secSum: 0,
          });
        }

        const entry = grouped.get(dateKey)!;
        entry.healthSum += a.score ?? 0;
        entry.secSum += a.securityScore ?? 0;
        entry.compSum += a.complexityScore ?? 0;
        entry.onbSum += a.onboardingScore ?? 0;
        entry.debtSum += a.techDebtScore ?? 0;
        entry.count += 1;
      });

      return Array.from(grouped.entries()).map(([date, data]) => ({
        complexity: Math.round(data.compSum / data.count),
        date,
        fullDate: date,
        health: Math.round(data.healthSum / data.count),
        onboarding: Math.round(data.onbSum / data.count),
        security: Math.round(data.secSum / data.count),
        techDebt: Math.round(data.debtSum / data.count),
      }));
    }),
});
