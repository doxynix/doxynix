import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";

import { RepoPullsListContainer } from "@/features/repo-pulls/ui/repo-pulls-list-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("pulls");

export default async function RepoPullsPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <RepoPullsListContainer
      name={name}
      owner={owner}
      repoId={repo.id}
    />
  );
}
