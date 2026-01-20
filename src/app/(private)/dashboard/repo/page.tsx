import { Suspense } from "react";
import type { Metadata } from "next";

import { AppSearch } from "@/shared/ui/AppSearch";
import { Skeleton } from "@/shared/ui/skeleton";
import { CreateRepoButton, RepoFilters, RepoListContainer } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";

export const metadata: Metadata = {
  title: "Repositories",
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
      <div className="mb-4 flex items-center not-sm:justify-center">
        <h1 className="text-2xl font-bold">Repositories</h1>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-2 xl:justify-between">
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <AppSearch placeholder="Search repository..." />
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
