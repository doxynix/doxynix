import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppSearch } from "@/shared/ui/AppSearch";
import { Skeleton } from "@/shared/ui/skeleton";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";
import { api } from "@/server/trpc/server";

type Props = {
  params: Promise<{ owner: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    visibility?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner } = await params;
  return {
    title: owner,
    description: `Обзор репозиториев организации ${owner}`,
  };
}

export default async function OwnerPage({ params, searchParams }: Props) {
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{owner}</h1>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <AppSearch placeholder={`Поиск в ${owner}...`} />
            <RepoFilters />
          </div>
          <CreateRepoButton />
        </div>
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
