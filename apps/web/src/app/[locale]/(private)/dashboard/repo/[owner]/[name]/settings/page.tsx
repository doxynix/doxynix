import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { createRepoMetadata } from "@/shared/lib/metadata";

import { DeleteRepoCard } from "@/features/repo-settings/ui/delete-repo-card";
import { PRAnalysisConfigCard } from "@/features/repo-settings/ui/pr-analysis-config-card";

import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

type Props = {
  params: Promise<{ name: string; owner: string }>;
  searchParams: Promise<SearchParams>;
};

export const generateMetadata = createRepoMetadata("settings");

export default async function RepoSettingsPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;
  const t = await getTranslations("Dashboard");

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  return (
    <>
      <PRAnalysisConfigCard repoId={repo.id} />
      <h2 className="font-bold text-2xl text-destructive">{t("settings_danger_title")}</h2>
      <DeleteRepoCard id={repo.id} />
    </>
  );
}
