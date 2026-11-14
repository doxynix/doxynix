import {
  EcosystemStatusSkeleton,
  HealthExtremesSkeleton,
  LanguagesSkeleton,
  RecentActivitySkeleton,
  SystemRisksSkeleton,
} from "./analytics-widgets-skeleton";

export function DashboardInsightsSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:col-span-4">
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
