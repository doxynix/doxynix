"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";

import { adminReviewParsers } from "../model/admin-review-parsers";
import { AdminReviewSkeleton } from "./admin-review-skeleton";
import { AdminReviewTable } from "./admin-review-table";
import { AdminReviewToolbar } from "./admin-review-toolbar";

const PAGE_SIZE = 20;

export function AdminReviewContainer() {
  const trpc = useTRPC();
  const [filters] = useQueryStates(adminReviewParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.adminReview.list.infiniteQueryOptions(
      {
        fixStatus: filters.fixStatus ?? undefined,
        from: filters.from ?? undefined,
        limit: PAGE_SIZE,
        minRiskScore:
          filters.minRiskScore == null ? undefined : Number.parseInt(filters.minRiskScore, 10),
        search: debouncedSearch || undefined,
        status: filters.status ?? undefined,
        to: filters.to ?? undefined,
      },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const reviews = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading || data == null) {
    return (
      <div className="flex flex-col gap-4">
        <AdminReviewToolbar />
        <AdminReviewSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminReviewToolbar />

      <AdminReviewTable reviews={reviews} />

      <AppInfiniteSentinel
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}
