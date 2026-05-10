import type { Metadata } from "next";

import type { ParamTypes } from "@/shared/types/app.types";

import { DeleteRepoCard } from "@/features/repo-settings/ui/delete-repo-card";
import { PRAnalysisConfigCard } from "@/features/repo-settings/ui/pr-analysis-config-card";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<{ [key: string]: ParamTypes }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, owner } = await params;

  return {
    title: `${owner}/${name}`,
  };
}

export default async function RepoSettingsPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <>
      <PRAnalysisConfigCard repoId={repo.id} />
      <h2 className="text-destructive text-2xl font-bold">Danger Zone</h2>
      <DeleteRepoCard id={repo.id} />
    </>
  );
}
