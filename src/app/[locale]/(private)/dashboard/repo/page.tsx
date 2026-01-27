import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

export const generateMetadata = createMetadata("repositories_title", "repositories_desc");

export default async function RepoPage() {
  const t = await getTranslations("Dashboard");

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="mb-4 flex items-center not-sm:justify-center">
        <h1 className="text-2xl font-bold">{t("repo_title")}</h1>
      </div>
      <div className="mb-4 flex w-full flex-wrap items-center justify-center gap-2 xl:justify-between">
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <AppSearch placeholder={t("repo_search_repository")} />
          <RepoFilters />
        </div>
        <CreateRepoButton />
      </div>

      <RepoListContainer />
    </div>
  );
}
