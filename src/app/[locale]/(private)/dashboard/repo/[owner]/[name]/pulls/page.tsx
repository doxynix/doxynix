import type { Metadata } from "next";

import type { RepoPageProps } from "@/shared/types/next.types";

import { RepoPullsListContainer } from "@/features/repo-pulls/ui/repo-pulls-list-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoPullsPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return <RepoPullsListContainer name={name} owner={owner} repoId={repo.id} />;
}
