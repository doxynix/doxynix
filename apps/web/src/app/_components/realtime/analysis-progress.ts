import type { DashboardStats } from "@/widgets/dashboard/model/dashboard.types";

type AnalysisProgress = {
  analysisId: string;
  progress: number;
  status: DashboardStats["recentActivity"][number]["status"];
};

export function patchAnalysisProgress(
  stats: DashboardStats | undefined,
  payload: AnalysisProgress,
): DashboardStats | undefined {
  if (stats == null) {
    return stats;
  }

  return {
    ...stats,
    recentActivity: stats.recentActivity.map((activity) =>
      activity.id === payload.analysisId
        ? { ...activity, progress: payload.progress, status: payload.status }
        : activity,
    ),
  };
}
