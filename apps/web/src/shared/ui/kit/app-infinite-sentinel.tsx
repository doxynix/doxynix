"use client";
import { useEffect, useRef } from "react";

import { useIntersectionObserver } from "@/shared/lib/hooks/use-intersection-observer";
import { Spinner } from "@/shared/ui/core/spinner";

type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => Promise<unknown> | void;
};

export function AppInfiniteSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Readonly<Props>) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { observe, unobserve } = useIntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void onLoadMore();
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
  }, [hasNextPage, isFetchingNextPage, observe, onLoadMore, unobserve]);

  if (!hasNextPage) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center py-2"
      ref={sentinelRef}
    >
      {isFetchingNextPage && <Spinner />}
    </div>
  );
}
