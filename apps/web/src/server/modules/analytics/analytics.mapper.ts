import type { getTrends } from "@prisma/client/sql";

import type { DashboardStats, Trends } from "./analytics.schemas";

export type TrendRecord = getTrends.Result;

export type RecentActivityRecord = {
  createdAt: string;
  id: string;
  progress: number;
  repoName: string;
  repoOwner: string;
  status: DashboardStats["recentActivity"][number]["status"];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const analyticsMapper = {
  toRecentActivity(activity: RecentActivityRecord): DashboardStats["recentActivity"][number] {
    return {
      createdAt: new Date(activity.createdAt),
      id: activity.id,
      progress: activity.progress,
      repoName: activity.repoName,
      repoOwner: activity.repoOwner,
      status: activity.status,
    };
  },

  toTrend(trend: TrendRecord): Trends[number] {
    const dateKey = trend.dateKey ?? new Date();

    return {
      complexity: trend.complexity ?? 0,
      date: DATE_FORMATTER.format(dateKey),
      fullDate: dateKey.toISOString().slice(0, 10),
      health: trend.health ?? 0,
      onboarding: trend.onboarding ?? 0,
      security: trend.security ?? 0,
      techDebt: trend.techDebt ?? 0,
    };
  },
};
