"use client";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

import { RepoMetrics } from "./repo-metrics";

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
    return (
      <div className="flex flex-col gap-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72 lg:col-span-2" />
        </section>

        <section className="flex flex-col gap-4">
          <SkeletonText
            lines={1}
            size="xxl"
            widths={["w-56"]}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </section>
      </div>
    );
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
