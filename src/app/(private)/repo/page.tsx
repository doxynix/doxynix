import { Suspense } from "react";
import type { Metadata } from "next";

import { AppSearch } from "@/shared/ui/AppSearch/ui";
import { CreateRepoButton } from "@/features/repo/ui/CreateRepoButton";
import { RepoCardSkeleton } from "@/features/repo/ui/RepoCard/ui/RepoCardSkeleton";
import { RepoFilters } from "@/features/repo/ui/RepoFilters";
import { RepoListContainer } from "@/features/repo/ui/RepoListContainer/ui";

export const metadata: Metadata = {
  title: "Репозитории",
};

type RepoPageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    visibility?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function RepoPage({ searchParams }: RepoPageProps) {
  const params = await searchParams;
  const suspenseKey = JSON.stringify(params);

  return (
    <div className="mx-auto flex h-full w-full flex-col space-y-6">
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
