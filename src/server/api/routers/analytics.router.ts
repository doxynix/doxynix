import { z } from "zod";

import { analyticsService } from "@/server/entities/analyze/api/analytics.service";
import { StatusSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const DashboardStatsOutputSchema = z.object({
  analysisStats: z.object({
    failed: z.number(),
    new: z.number(),
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
    complexityDelta: z.number(),
    criticalRepoCount: z.number(),
    docsCount: z.number(),
    healthDelta: z.number(),
    onboardingDelta: z.number(),
    repoCount: z.number(),
    securityDelta: z.number(),
    techDebtDelta: z.number(),
    totalLoc: z.number(),
  }),
  recentActivity: z.array(
    z.object({
      createdAt: z.date(),
      id: z.uuid(),
      progress: z.number(),
      repoName: z.string(),
      repoOwner: z.string(),
      status: StatusSchema,
    })
  ),
  risks: z.object({
    busFactorRepos: z.number(),
    topCoupling: z.array(
      z.object({
        commits: z.number(),
        from_path: z.string(),
        repo_name: z.string(),
        to_path: z.string(),
      })
    ),
    topHotspots: z.array(
      z.object({
        path: z.string(),
        repo_name: z.string(),
        score: z.number(),
      })
    ),
  }),
});

const TrendsOutputSchema = z.array(
  z.object({
    complexity: z.number(),
    date: z.string(),
    fullDate: z.string(),
    health: z.number(),
    onboarding: z.number(),
    security: z.number(),
    techDebt: z.number(),
  })
);

const InputSchema = z.object({
  from: z.date().optional(),
  period: z.string().optional().default("30d"),
  to: z.date().optional(),
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
    .input(InputSchema)
    .output(DashboardStatsOutputSchema)
    .query(async ({ ctx, input }) => {
      return analyticsService.getDashboardStats(ctx.db, input, Number(ctx.session.user.id));
    }),

  getTrends: protectedProcedure
    .meta({
      openapi: {
        description:
          "Returns daily averages for security, health, and complexity scores over the last 30 days.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/analytics/trends",
        protect: true,
        summary: "Get 30-day analysis trends",
        tags: ["analytics"],
      },
    })
    .input(InputSchema)
    .output(TrendsOutputSchema)
    .query(async ({ ctx, input }) => {
      return analyticsService.getTrends(ctx.db, input, Number(ctx.session.user.id));
    }),
});
