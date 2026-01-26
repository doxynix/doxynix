import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { SearchParams } from "@/shared/types/search-params";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";

export const generateMetadata = createMetadata("repositories_title", "repositories_desc");

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function RepoPage({ searchParams }: Props) {
  const t = await getTranslations("Dashboard");
  const params = await searchParams;
  const suspenseKey = JSON.stringify(params);

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="mb-4 flex items-center not-sm:justify-center">
        <h1 className="text-2xl font-bold">{t("repo_title")}</h1>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-2 xl:justify-between">
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <AppSearch placeholder={t("repo_search_repository")} />
          <RepoFilters />
        </div>
        <CreateRepoButton />
      </div>
      <Suspense
        key={suspenseKey}
        fallback={
          <>
            <Skeleton className="my-4 ml-auto h-5 w-24 text-sm" />
            <RepoCardSkeleton count={5} />
          </>
        }
      >
        <RepoListContainer searchParams={params} />
      </Suspense>
    </div>
  );
}
