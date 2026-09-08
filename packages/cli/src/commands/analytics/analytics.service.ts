import { trpc } from "@/core/client";

import { type DashboardStatsInput, type TrendsInput } from "./analytics.types";

export const analyticsService = {
  async getDashboardStats(input?: DashboardStatsInput) {
    return trpc.analytics.getDashboardStats.query(input ?? {});
  },

  async getTrends(input?: TrendsInput) {
    return trpc.analytics.getTrends.query(input ?? {});
  },
};
