import { Suspense } from "react";

import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoMetricsContainer } from "@/features/repo-analytics/ui/repo-metrics-container";
import { RepoMetricsSkeleton } from "@/features/repo-analytics/ui/repo-metrics-skeleton";
import { RepoOverviewContainer } from "@/features/repo-analytics/ui/repo-overview-container";
import { RepoOverviewSkeleton } from "@/features/repo-analytics/ui/repo-overview-skeleton";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("overview");

export default async function RepoOwnerNamePage({ params, searchParams }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  const query = await searchParams;
  const aid = Array.isArray(query.aid) ? query.aid[0] : query.aid;

  return (
    <div className="flex flex-col gap-10">
      <Suspense fallback={<RepoOverviewSkeleton />}>
        <OverviewSection
          aid={aid}
          repoId={repo.id}
        />
      </Suspense>
      <Suspense fallback={<RepoMetricsSkeleton />}>
        <MetricsSection repoId={repo.id} />
      </Suspense>
    </div>
  );
}

async function OverviewSection({
  aid,
  repoId,
}: Readonly<{ aid: string | undefined; repoId: string }>) {
  await prefetch(trpcProxy.analysis.getWorkspace.queryOptions({ aid, repoId }));

  return (
    <HydrateClient>
      <RepoOverviewContainer repoId={repoId} />
    </HydrateClient>
  );
}

async function MetricsSection({ repoId }: Readonly<{ repoId: string }>) {
  await prefetch(trpcProxy.analysis.getDetailedMetrics.queryOptions({ repoId }));

  return (
    <HydrateClient>
      <RepoMetricsContainer repoId={repoId} />
    </HydrateClient>
  );
}
