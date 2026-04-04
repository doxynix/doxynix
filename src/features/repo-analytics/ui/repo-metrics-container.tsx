"use client";

import { Activity } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { RepoAnalyzeButton, useRepoParams } from "@/entities/repo";

import { RepoMetrics } from "./repo-metrics";

export function RepoMetricsContainer({ id }: Readonly<{ id: string }>) {
  const { name, owner } = useRepoParams();

  const { data, isLoading } = trpc.repoDetails.getDetailedMetrics.useQuery({
    repoId: id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="col-span-2 h-80" />
          <Skeleton className="col-span-1 h-80" />
        </div>
      </div>
    );
  }

  if (data == null) {
    return (
      <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
        <EmptyState
          action={<RepoAnalyzeButton name={name} owner={owner} />}
          description="Detailed code metrics will appear here after the first analysis."
          icon={Activity}
          title="No metrics data available"
        />
      </div>
    );
  }

  return <RepoMetrics data={data} />;
}
