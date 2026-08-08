import type { Metadata } from "next";

import type { RepoPageProps } from "@/shared/types/next.types";

import { RepoMapContainer } from "@/features/repo-map/ui/repo-map-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoMapPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return <RepoMapContainer id={repo.id} />;
}
