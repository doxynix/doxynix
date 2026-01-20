import { Suspense } from "react";
import type { Metadata } from "next";

import { CreateRepoButton, RepoListContainer, StatCard, StatCardSkeleton } from "@/features/repo";

import { RepoCardSkeleton } from "@/entities/repo";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto h-full w-full">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Suspense fallback={<StatCardSkeleton />}>
          <StatCard />
        </Suspense>
      </div>
      <div className="xs:justify-between mb-4 flex flex-wrap items-center justify-center gap-3">
        <p className="xs:order-0 xs:text-base order-1 text-sm">Recent Repositories</p>
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
