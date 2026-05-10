import { OpenApiErrorResponses } from "@/server/core/trpc/constants";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { AnalyticsInputSchema, DashboardStatsSchema, TrendsSchema } from "./analytics.schemas";
import { analyticsService } from "./analytics.service";

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
    .input(AnalyticsInputSchema)
    .output(DashboardStatsSchema)
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
    .input(AnalyticsInputSchema)
    .output(TrendsSchema)
    .query(async ({ ctx, input }) => {
      return analyticsService.getTrends(ctx.db, input, Number(ctx.session.user.id));
    }),
});
