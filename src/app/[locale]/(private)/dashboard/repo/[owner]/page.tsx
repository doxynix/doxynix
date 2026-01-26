import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SearchParams } from "@/shared/types/search-params";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";
import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{ owner: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner } = await params;
  return {
    title: owner,
    description: `Repository overview for ${owner}`,
  };
}

export default async function OwnerPage({ params, searchParams }: Props) {
  const t = await getTranslations("Dashboard");
  const { owner } = await params;
  const searchParamsValues = await searchParams;

  const ownerExists = await (
    await api()
  ).repo.getAll({
    limit: 1,
    owner: owner,
  });

  if (ownerExists.items.length === 0) {
    notFound();
  }

  const listParams = {
    ...searchParamsValues,
    owner: owner,
  };

  const suspenseKey = JSON.stringify(listParams);

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="not-xs:justify-center mb-4 flex items-center">
        <h1 className="text-2xl font-bold">{owner}</h1>
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
        <RepoListContainer searchParams={listParams} />
      </Suspense>
    </div>
  );
}
