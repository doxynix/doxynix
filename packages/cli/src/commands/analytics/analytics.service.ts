import { trpc } from "@/core/client";

export const analyticsService = {
  async getDashboardStats(input?: { repoId?: string; timeframe?: string }) {
    return trpc.analytics.getDashboardStats.query((input as any) ?? {});
  },

  async getTrends(input?: { repoId?: string; timeframe?: string }) {
    return trpc.analytics.getTrends.query((input as any) ?? {});
  },
};
