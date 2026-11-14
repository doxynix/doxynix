import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import { StatCardSkeleton } from "@/entities/repo/ui/stat-card-skeleton";

export function StatCardsSkeleton() {
  return (
    <SkeletonList
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      count={8}
      renderItem={() => <StatCardSkeleton />}
    />
  );
}
