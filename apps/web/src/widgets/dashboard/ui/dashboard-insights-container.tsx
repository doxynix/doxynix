"use client";

import { useDashboardStats } from "../model/use-dashboard-stats";
import {
  EcosystemStatusWidget,
  HealthExtremesWidget,
  LanguagesWidget,
  RecentActivityWidget,
  SystemRisksWidget,
} from "./analytics-widgets";
import { DashboardInsightsSkeleton } from "./dashboard-insights-skeleton";

export function DashboardInsightsContainer() {
  const { data, isLoading } = useDashboardStats();

  if (isLoading || data == null) {
    return <DashboardInsightsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6 lg:col-span-4">
      <EcosystemStatusWidget data={data} />
      <SystemRisksWidget data={data} />

      <div className="grid grid-cols-1 gap-6">
        <HealthExtremesWidget data={data} />
        <LanguagesWidget data={data} />
        <RecentActivityWidget data={data} />
      </div>
    </div>
  );
}
