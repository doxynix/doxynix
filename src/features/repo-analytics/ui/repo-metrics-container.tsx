"use client";

import { AlertCircle } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";

import { RepoMetrics } from "./repo-metrics";

export function RepoMetricsContainer({ id }: Readonly<{ id: string }>) {
  const { data, error, isLoading } = trpc.repoDetails.getDetailedMetrics.useQuery({
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

  if (error || !data) {
    return (
      <div className="text-destructive flex flex-col items-center justify-center py-20">
        <AlertCircle className="mb-4 size-10" />
        <p>Failed to load analysis metrics. Make sure analysis is completed.</p>
      </div>
    );
  }

  return <RepoMetrics data={data} />;
}
