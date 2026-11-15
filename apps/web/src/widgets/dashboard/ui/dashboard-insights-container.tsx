"use client";

import { QueryError } from "@/shared/ui/kit/query-error";

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
  const { data, error, isError, isLoading, refetch } = useDashboardStats();

  if (isLoading) {
    return <DashboardInsightsSkeleton />;
  }

  if (isError || data == null) {
    return (
      <QueryError
        className="lg:col-span-4"
        error={error}
        onRetry={() => void refetch()}
      />
    );
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
