"use client";

import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";

import { dashboardParsers } from "../model/dashboard-parsers";
import {
  EcosystemStatusWidget,
  HealthExtremesWidget,
  LanguagesWidget,
  RecentActivityWidget,
  SystemRisksWidget,
} from "./analytics-widgets";
import {
  EcosystemStatusSkeleton,
  HealthExtremesSkeleton,
  LanguagesSkeleton,
  RecentActivitySkeleton,
  SystemRisksSkeleton,
} from "./analytics-widgets-skeleton";

export function DashboardInsightsContainer() {
  const [urlParams] = useQueryStates(dashboardParsers);

  const { data, isLoading } = trpc.analytics.getDashboardStats.useQuery({
    from: urlParams.from ?? undefined,
    period: urlParams.period ?? undefined,
    to: urlParams.to ?? undefined,
  });

  if (isLoading || data == null) {
    return (
      <div className="space-y-6 lg:col-span-4">
        <EcosystemStatusSkeleton />
        <SystemRisksSkeleton />

        <div className="grid grid-cols-1 gap-6">
          <HealthExtremesSkeleton />
          <LanguagesSkeleton />
          <RecentActivitySkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:col-span-4">
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
