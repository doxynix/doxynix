import z from "zod";

import StatusSchema, { type StatusType } from "@/generated/zod/inputTypeSchemas/StatusSchema";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

const LanguageMetricSchema = z.object({
  name: z.string(),
  color: z.string(),
  lines: z.number(),
});

const MetricsJsonSchema = z.object({
  languages: z.array(LanguageMetricSchema).optional(),
  totalLoc: z.number().optional(),
});

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/analytics",
        tags: ["analytics"],
        summary: "Get rich dashboard statistics",
        description: "Returns aggregated metrics, global scores, and language distribution.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(
      z.object({
        overview: z.object({
          repoCount: z.number(),
          docsCount: z.number(),
          totalLoc: z.number(),
          avgHealthScore: z.number(),
          avgSecurityScore: z.number(),
          avgComplexityScore: z.number(),
          avgOnboardingScore: z.number(),
          avgTechDebtScore: z.number(),
          criticalRepoCount: z.number(),
        }),
        analysisStats: z.object({
          total: z.number(),
          failed: z.number(),
          pending: z.number(),
          success: z.number(),
        }),
        languages: z.array(
          z.object({
            name: z.string(),
            value: z.number(),
            color: z.string(),
          })
        ),
        recentActivity: z.array(
          z.object({
            id: z.string(),
            repoOwner: z.string(),
            repoName: z.string(),
            status: StatusSchema,
            progress: z.number(),
            createdAt: z.date(),
          })
        ),
        highlights: z.object({
          mostCritical: z.object({ name: z.string(), score: z.number() }).nullable(),
          topPerformer: z.object({ name: z.string(), score: z.number() }).nullable(),
        }),
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
          by: ["status"],
          _count: { status: true },
        }),

        ctx.db.analysis.aggregate({
          _avg: {
            score: true,
            securityScore: true,
            complexityScore: true,
            onboardingScore: true,
            techDebtScore: true,
          },
          where: { status: "DONE" },
        }),

        ctx.db.analysis.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { repo: { select: { name: true, owner: true } } },
        }),

        ctx.db.repo.findMany({
          select: {
            analyses: {
              take: 1,
              orderBy: { createdAt: "desc" },
              where: { status: "DONE" },
              select: { metricsJson: true },
            },
          },
        }),
        ctx.db.analysis.findFirst({
          where: { status: "DONE", score: { gt: 0, lt: 50 } },
          orderBy: { score: "asc" },
          select: { score: true, repo: { select: { name: true } } },
        }),

        ctx.db.analysis.findFirst({
          where: { status: "DONE" },
          orderBy: { score: "desc" },
          select: { score: true, repo: { select: { name: true } } },
        }),
        ctx.db.repo.count({
          where: {
            analyses: {
              some: {
                status: "DONE",
                score: { lt: 50, gt: 0 },
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

      const langMap = new Map<string, { lines: number; color: string }>();
      let globalTotalLoc = 0;

      reposWithMetrics.forEach((repo) => {
        const metrics = repo.analyses[0]?.metricsJson;
        if (metrics == null) return;

        const parsed = MetricsJsonSchema.safeParse(metrics);
        if (parsed.success) {
          globalTotalLoc += parsed.data.totalLoc ?? 0;
          parsed.data.languages?.forEach((lang) => {
            const current = langMap.get(lang.name) || { lines: 0, color: lang.color };
            langMap.set(lang.name, {
              lines: current.lines + lang.lines,
              color: lang.color,
            });
          });
        }
      });

      const sortedLanguages = Array.from(langMap.entries())
        .map(([name, data]) => ({ name, value: data.lines, color: data.color }))
        .sort((a, b) => b.value - a.value);

      const topLanguages = sortedLanguages.slice(0, 5);
      const otherLines = sortedLanguages.slice(5).reduce((acc, curr) => acc + curr.value, 0);

      if (otherLines > 0) {
        topLanguages.push({ name: "Other", value: otherLines, color: "#808080" });
      }

      return {
        overview: {
          repoCount,
          docsCount,
          totalLoc: globalTotalLoc,
          avgHealthScore: Math.round(aggregates._avg.score ?? 0),
          avgComplexityScore: Math.round(aggregates._avg.complexityScore ?? 0),
          avgOnboardingScore: Math.round(aggregates._avg.onboardingScore ?? 0),
          avgTechDebtScore: Math.round(aggregates._avg.techDebtScore ?? 0),
          avgSecurityScore: Math.round(aggregates._avg.securityScore ?? 0),
          criticalRepoCount,
        },
        analysisStats: {
          total: Object.values(statsMap).reduce((a, b) => a + b, 0),
          success: statsMap["DONE"] ?? 0,
          failed: statsMap["FAILED"] ?? 0,
          pending: (statsMap["PENDING"] ?? 0) + (statsMap["NEW"] ?? 0),
        },
        languages: topLanguages,
        recentActivity: recentAnalyses.map((a) => ({
          id: a.publicId,
          repoName: a.repo.name,
          repoOwner: a.repo.owner,
          status: a.status as StatusType,
          progress: a.progress,
          createdAt: a.createdAt,
        })),
        highlights: {
          mostCritical:
            worstRepo != null ? { name: worstRepo.repo.name, score: worstRepo.score ?? 0 } : null,
          topPerformer:
            bestRepo != null ? { name: bestRepo.repo.name, score: bestRepo.score ?? 0 } : null,
        },
      };
    }),
  getTrends: protectedProcedure
    .output(
      z.array(
        z.object({
          date: z.string(),
          fullDate: z.string(),
          health: z.number(),
          security: z.number(),
          complexity: z.number(),
          onboarding: z.number(),
          techDebt: z.number(),
        })
      )
    )
    .query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const analyses = await ctx.db.analysis.findMany({
        where: {
          status: "DONE",
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          score: true,
          securityScore: true,
          complexityScore: true,
          onboardingScore: true,
          techDebtScore: true,
        },
      });

      const grouped = new Map<
        string,
        {
          healthSum: number;
          secSum: number;
          compSum: number;
          onbSum: number;
          debtSum: number;
          count: number;
        }
      >();

      analyses.forEach((a) => {
        const dateKey = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(a.createdAt);

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            healthSum: 0,
            secSum: 0,
            compSum: 0,
            onbSum: 0,
            debtSum: 0,
            count: 0,
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
        date,
        fullDate: date,
        health: Math.round(data.healthSum / data.count),
        security: Math.round(data.secSum / data.count),
        complexity: Math.round(data.compSum / data.count),
        onboarding: Math.round(data.onbSum / data.count),
        techDebt: Math.round(data.debtSum / data.count),
      }));
    }),
});
