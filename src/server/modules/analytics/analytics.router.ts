import { analyticsService } from "@/server/modules/analytics/analytics.service";

import { OpenApiErrorResponses } from "../../api/contracts";
import { createTRPCRouter, protectedProcedure } from "../../api/trpc";
import { AnalyticsInputSchema, DashboardStatsSchema, TrendsSchema } from "./analytics.schemas";

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
