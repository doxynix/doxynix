import { REPO_ANALYSIS_PAGE_SIZE } from "@/shared/config/repos";
import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoPullsListContainer } from "@/features/repo-pulls/ui/repo-pulls-list-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("pulls");

export default async function RepoPullsPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  await prefetch(
    trpcProxy.analysis.listByRepository.infiniteQueryOptions(
      { limit: REPO_ANALYSIS_PAGE_SIZE, repoId: repo.id },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  return (
    <HydrateClient>
      <RepoPullsListContainer
        name={name}
        owner={owner}
        repoId={repo.id}
      />
    </HydrateClient>
  );
}
