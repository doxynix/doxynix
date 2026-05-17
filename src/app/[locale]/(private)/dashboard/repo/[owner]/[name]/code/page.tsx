import type { Metadata } from "next";

import type { RepoPageProps } from "@/shared/types/next.types";

import { RepoCodeContainer } from "@/features/repo-code-viewer/ui/repo-code-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoDocsPage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return <RepoCodeContainer repo={repo} />;
}
