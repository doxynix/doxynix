import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import type { PageProps } from "@/shared/lib/next.types";
import { hasAnySearchParam } from "@/shared/lib/url-state";
import { AppSearch } from "@/shared/ui/kit/app-search";

import {
  REPO_LIST_DEFAULT_LIMIT,
  REPO_LIST_DEFAULT_SORT_BY,
  repoParsers,
} from "@/entities/repo/model/repo-parsers";

import { CreateRepoButton } from "@/features/repo/ui/create-repo-button";
import { RepoFilters } from "@/features/repo/ui/repo-filters";
import { RepoListContainer } from "@/features/repo/ui/repo-list-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export const generateMetadata = createMetadata("repositories_title", "repositories_desc");

export default async function ReposPage({ searchParams }: Readonly<PageProps>) {
  const t = await getTranslations("Dashboard");

  if (!hasAnySearchParam(await searchParams, Object.keys(repoParsers))) {
    await prefetch(
      trpcProxy.repo.getAll.queryOptions({
        limit: REPO_LIST_DEFAULT_LIMIT,
        page: 1,
        sortBy: REPO_LIST_DEFAULT_SORT_BY,
      }),
    );
  }

  return (
    <HydrateClient>
      <div className="mx-auto flex h-full w-full flex-col">
        <div className="mb-4 flex items-center not-sm:justify-center">
          <h1 className="font-bold text-2xl">{t("repo_title")}</h1>
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
    </HydrateClient>
  );
}
