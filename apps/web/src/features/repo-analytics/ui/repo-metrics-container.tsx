"use client";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

import { RepoMetrics } from "./repo-metrics";
import { RepoMetricsSkeleton } from "./repo-metrics-skeleton";

type Props = {
  repoId: string;
};

export function RepoMetricsContainer({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.analysis.getDetailedMetrics.queryOptions({
      repoId,
    }),
  );

  if (isLoading) {
    return <RepoMetricsSkeleton />;
  }

  if (data == null) {
    return null;
  }

  return (
    <RepoMetrics
      data={data}
      repoId={repoId}
    />
  );
}
