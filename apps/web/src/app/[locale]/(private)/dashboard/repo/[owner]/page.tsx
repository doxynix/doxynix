import { getTranslations } from "next-intl/server";

import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";
import { hasAnySearchParam } from "@/shared/lib/url-state";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppSearch } from "@/shared/ui/kit/app-search";

import {
  REPO_LIST_DEFAULT_LIMIT,
  REPO_LIST_DEFAULT_SORT_BY,
  repoParsers,
} from "@/entities/repo/model/repo-parsers";

import { CreateRepoButton } from "@/features/repo/ui/create-repo-button";
import { DeleteByOwnerDialog } from "@/features/repo/ui/delete-by-owner-dialog";
import { RepoFilters } from "@/features/repo/ui/repo-filters";
import { RepoListContainer } from "@/features/repo/ui/repo-list-container";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("owner");

export default async function OwnerPage({ params, searchParams }: Readonly<RepoPageProps>) {
  const t = await getTranslations("Dashboard");
  const { owner } = await params;

  const data = await repoFetchers.getOwnerOrNotFound(owner);

  if (!hasAnySearchParam(await searchParams, Object.keys(repoParsers))) {
    await prefetch(
      trpcProxy.repo.getAll.queryOptions({
        limit: REPO_LIST_DEFAULT_LIMIT,
        owner,
        page: 1,
        sortBy: REPO_LIST_DEFAULT_SORT_BY,
      }),
    );
  }

  const avatarUrl = data.ownerAvatarUrl;

  return (
    <HydrateClient>
      <div className="mx-auto flex h-full w-full flex-col">
        <div className="mb-4 flex items-center not-xs:justify-center gap-4">
          <AppAvatar
            alt={owner}
            fallbackText={owner}
            sizeClassName="size-9"
            src={avatarUrl}
          />
          <h1 className="font-bold text-2xl">{owner}</h1>
        </div>

        <div className="mb-4 flex w-full flex-wrap items-center justify-center gap-2 xl:justify-between">
          <div className="flex flex-col items-center gap-4 xl:flex-row">
            <AppSearch placeholder={t("repo_search_repository")} />
            <RepoFilters />
          </div>
          <CreateRepoButton />
          <DeleteByOwnerDialog owner={owner} />
        </div>

        <RepoListContainer config={{ forcedFilters: { owner } }} />
      </div>
    </HydrateClient>
  );
}
