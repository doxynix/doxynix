"use client";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { RepoMetrics } from "./repo-metrics";

type Props = {
  repoId: string;
};

export function RepoMetricsContainer({ repoId }: Readonly<Props>) {
  const { data, isLoading } = trpc.analysis.getDetailedMetrics.useQuery({
    repoId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="col-span-2 h-80" />
          <Skeleton className="col-span-1 h-80" />
        </div>
      </div>
    );
  }

  if (data == null) return null;

  return <RepoMetrics data={data} repoId={repoId} />;
}
