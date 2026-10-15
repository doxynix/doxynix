import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoMetricsContainer } from "@/features/repo-analytics/ui/repo-metrics-container";
import { RepoOverviewContainer } from "@/features/repo-analytics/ui/repo-overview-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("overview");

export default async function RepoOwnerNamePage({ params, searchParams }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  const query = await searchParams;
  const aid = Array.isArray(query.aid) ? query.aid[0] : query.aid;

  await Promise.all([
    prefetch(trpcProxy.analysis.getDetailedMetrics.queryOptions({ repoId: repo.id })),
    prefetch(
      trpcProxy.analysis.getWorkspace.queryOptions({
        aid: aid ?? undefined,
        repoId: repo.id,
      }),
    ),
  ]);

  return (
    <HydrateClient>
      <div className="flex flex-col gap-10">
        <RepoOverviewContainer repoId={repo.id} />
        <RepoMetricsContainer repoId={repo.id} />
      </div>
    </HydrateClient>
  );
}
