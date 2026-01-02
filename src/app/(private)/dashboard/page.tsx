import { Suspense } from "react";
import type { Metadata } from "next";

import { CreateRepoButton } from "@/features/repo/ui/CreateRepoButton";
import { RepoCardSkeleton } from "@/features/repo/ui/RepoCard/ui/RepoCardSkeleton";
import { RepoListContainer } from "@/features/repo/ui/RepoListContainer/ui";
import { StatCard } from "@/features/repo/ui/StatCard/ui";
import { StatCardSkeleton } from "@/features/repo/ui/StatCard/ui/StatCardSkeleton";

export const metadata: Metadata = {
  title: "Панель управления",
};

export default async function Dashboard() {
  return (
    <div className="mx-auto w-full">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Обзор</h1>
        <Suspense fallback={<StatCardSkeleton />}>
          <StatCard />
        </Suspense>
      </div>
      <div className="mb-4 flex justify-between">
        <p>Недавние репозитории</p>
        <CreateRepoButton />
      </div>
      <Suspense fallback={<RepoCardSkeleton count={4} />}>
        <RepoListContainer
          config={{
            limit: 4,
            showPagination: false,
            showTotalCount: false,
            forcedFilters: {
              sortBy: "updatedAt",
              sortOrder: "desc",
            },
          }}
        />
      </Suspense>
    </div>
  );
}
