import type { Metadata } from "next";

import type { RepoPageProps } from "@/shared/types/next.types";

import { RepoMetricsContainer } from "@/features/repo-analytics/ui/repo-metrics-container";
import { RepoOverviewContainer } from "@/features/repo-analytics/ui/repo-overview-container";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoOwnerNamePage({ params }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <div className="flex flex-col gap-10">
      <RepoOverviewContainer repoId={repo.id} />
      <RepoMetricsContainer repoId={repo.id} />
    </div>
  );
}
