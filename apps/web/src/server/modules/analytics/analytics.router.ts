import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { AnalyticsInputSchema, DashboardStatsSchema, TrendsSchema } from "./analytics.schemas";
import { analyticsService } from "./analytics.service";

export const analyticsRouter = createTRPCRouter({
  getDashboardStats: protectedProcedure
    .input(AnalyticsInputSchema)
    .output(DashboardStatsSchema)
    .query(async ({ ctx, input }) => {
      return analyticsService.getDashboardStats(ctx.db, input, Number(ctx.session.user.id));
    }),

  getTrends: protectedProcedure
    .input(AnalyticsInputSchema)
    .output(TrendsSchema)
    .query(async ({ ctx, input }) => {
      return analyticsService.getTrends(ctx.db, input, Number(ctx.session.user.id));
    }),
});
