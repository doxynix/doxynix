import { Suspense } from "react";
import type { Metadata } from "next";

import { AppSearch } from "@/shared/ui/AppSearch";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";

export const metadata: Metadata = {
  title: "Репозитории",
};

type Props = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    visibility?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function RepoPage({ searchParams }: Props) {
  const params = await searchParams;
  const suspenseKey = JSON.stringify(params);

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Репозитории</h1>
        <CreateRepoButton />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AppSearch placeholder="Найти репозиторий..." />
          <RepoFilters />
        </div>
      </div>
      <Suspense key={suspenseKey} fallback={<RepoCardSkeleton count={5} />}>
        <RepoListContainer searchParams={params} />
      </Suspense>
    </div>
  );
}
