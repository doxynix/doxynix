import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoDocsContainer } from "@/features/repo-docs-viewer/ui/repo-docs-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("docs");

export default async function RepoDocsPage({ params, searchParams }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  const query = await searchParams;
  const rawAid = query.aid;
  const aid = Array.isArray(rawAid) ? rawAid[0] : rawAid;

  await prefetch(
    trpcProxy.analysis.getAvailableDocs.queryOptions({ aid: aid ?? undefined, repoId: repo.id }),
  );

  return (
    <HydrateClient>
      <div className="flex flex-col gap-10">
        <RepoDocsContainer id={repo.id} />
      </div>
    </HydrateClient>
  );
}
