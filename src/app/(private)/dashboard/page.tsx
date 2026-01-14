import { Suspense } from "react";
import type { Metadata } from "next";

import { CreateRepoButton, RepoListContainer, StatCard, StatCardSkeleton } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";

export const metadata: Metadata = {
  title: "Панель управления",
};

export default function Dashboard() {
  return (
    <div className="mx-auto h-full w-full">
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
