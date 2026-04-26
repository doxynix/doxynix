import { z } from "zod";
import { analyticsService } from "@/server/entities/analyze/api/analytics.service";
import { StatusSchema } from "@/generated/zod";
import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Router for handling analytics-related operations.
 * Provides endpoints for fetching aggregated dashboard metrics and historical trends.
 */
export const analyticsRouter = createTRPCRouter({
  /**
   * Retrieves comprehensive dashboard statistics.
   *
   * This procedure aggregates data across all repositories to provide a high-level
   * overview of analysis statuses, performance highlights, language distribution,
   * and recent system activity.
   *
   * @returns {Promise<Object>} An object containing analysis stats, highlights, language data, overview metrics, and recent activity.
   * @throws {TRPCError} Throws an error if the user is unauthorized or database access fails.
   */
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

  /**
   * Retrieves historical trend data for repository metrics.
   *
   * Provides a time-series dataset representing the evolution of health, security,
   * complexity, onboarding, and technical debt scores.
   *
   * @returns {Promise<Array>} An array of trend data points indexed by date.
   * @throws {TRPCError} Throws an error if the user is unauthorized or database access fails.
   */
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