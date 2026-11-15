"use client";
import { useEffect, useRef } from "react";
import { isApiKeyDead } from "@doxynix/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";
import { useIntersectionObserver } from "@/shared/lib/hooks/use-intersection-observer";
import { Spinner } from "@/shared/ui/core/spinner";
import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import type { UiApiKey } from "@/entities/api-key/model/api-keys.types";
import { ApiKeyCardSkeleton } from "@/entities/api-key/ui/api-key-card-skeleton";

import { API_KEYS_PAGE_SIZE } from "../../model/pagination";
import { ApiKeysList } from "./api-keys-list";

function partitionKeys(keys: UiApiKey[]) {
  const now = Date.now();

  return {
    active: keys.filter((key) => !isApiKeyDead(key, now)),
    archived: keys.filter((key) => isApiKeyDead(key, now)),
  };
}

export function ApiKeysListContainer() {
  const trpc = useTRPC();

  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.apikey.list.infiniteQueryOptions(
      { limit: API_KEYS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const { observe, unobserve } = useIntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void fetchNextPage();
      }
    },
    { threshold: 0.1 },
  );

  useEffect(() => {
    const target = sentinelRef.current;
    if (!hasNextPage || isFetchingNextPage || target == null) {
      return;
    }

    observe(target);

    return () => {
      unobserve(target);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, observe, unobserve]);

  if (isLoading || data == null) {
    return (
      <SkeletonList
        className="grid grid-cols-2 gap-2"
        count={4}
        renderItem={() => <ApiKeyCardSkeleton />}
      />
    );
  }

  const { active, archived } = partitionKeys(data.pages.flatMap((page) => page.items));

  return (
    <div className="flex w-full flex-col gap-6">
      <ApiKeysList
        active={active}
        archived={archived}
      />

      {hasNextPage && (
        <div
          className="flex items-center justify-center py-2"
          ref={sentinelRef}
        >
          {isFetchingNextPage && <Spinner />}
        </div>
      )}
    </div>
  );
}
