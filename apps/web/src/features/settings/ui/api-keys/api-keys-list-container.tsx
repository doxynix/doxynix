"use client";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";
import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";
import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import { ApiKeyCardSkeleton } from "@/entities/api-key/ui/api-key-card-skeleton";

import { API_KEYS_PAGE_SIZE } from "../../model/pagination";
import { ApiKeysList } from "./api-keys-list";

export function ApiKeysListContainer() {
  const trpc = useTRPC();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.apikey.list.infiniteQueryOptions(
      { limit: API_KEYS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const {
    data: archivedData,
    fetchNextPage: fetchNextArchivedPage,
    hasNextPage: hasNextArchivedPage,
    isFetchingNextPage: isFetchingNextArchivedPage,
  } = useInfiniteQuery(
    trpc.apikey.listArchived.infiniteQueryOptions(
      { limit: API_KEYS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  if (isLoading || data == null) {
    return (
      <SkeletonList
        className="grid grid-cols-2 gap-2"
        count={4}
        renderItem={() => <ApiKeyCardSkeleton />}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <ApiKeysList
        active={data.pages.flatMap((page) => page.items)}
        archived={archivedData?.pages.flatMap((page) => page.items) ?? []}
        archivedPagination={{
          hasNextPage: hasNextArchivedPage,
          isFetchingNextPage: isFetchingNextArchivedPage,
          onLoadMore: fetchNextArchivedPage,
        }}
      />

      <AppInfiniteSentinel
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}
