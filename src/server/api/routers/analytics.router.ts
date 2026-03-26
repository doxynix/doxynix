import { z } from "zod";

import { analyticsService } from "@/server/services/analytics.service";
import { StatusSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
      return analyticsService.getDashboardStats(ctx.db);
    }),

  getTrends: protectedProcedure
    .input(z.void())
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
      return analyticsService.getTrends(ctx.db);
    }),
});
