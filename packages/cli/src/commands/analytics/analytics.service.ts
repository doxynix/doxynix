import { type RouterInput, trpc } from "@/core/client";

export const analyticsService = {
  async getDashboardStats(input?: RouterInput["analytics"]["getDashboardStats"]) {
    return trpc.analytics.getDashboardStats.query(input ?? {});
  },

  async getTrends(input?: RouterInput["analytics"]["getTrends"]) {
    return trpc.analytics.getTrends.query(input ?? {});
  },
};
