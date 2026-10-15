import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoMapContainer } from "@/features/repo-map/ui/repo-map-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("map");

export default async function RepoMapPage({ params, searchParams }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  const query = await searchParams;
  const rawAid = query.aid;
  const rawView = query.view;
  const aid = Array.isArray(rawAid) ? rawAid[0] : rawAid;
  const view = Array.isArray(rawView) ? rawView[0] : rawView;

  if (view == null) {
    await prefetch(
      trpcProxy.analysis.getStructureMap.queryOptions({ aid: aid ?? undefined, repoId: repo.id }),
    );
  }

  return (
    <HydrateClient>
      <RepoMapContainer id={repo.id} />
    </HydrateClient>
  );
}
