import { Skeleton } from "@/shared/ui/core/skeleton";

export function AnalyticsChartSkeleton() {
  return (
    <div className="flex aspect-video max-h-75 w-full items-center justify-center">
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
