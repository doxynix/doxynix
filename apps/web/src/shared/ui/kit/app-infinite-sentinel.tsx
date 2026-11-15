"use client";
import { useEffect, useRef } from "react";

import { useIntersectionObserver } from "@/shared/lib/hooks/use-intersection-observer";
import { Spinner } from "@/shared/ui/core/spinner";

type Props = {
  hasNextPage: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
};

export function AppInfiniteSentinel({ hasNextPage, isFetching, onLoadMore }: Readonly<Props>) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { observe, unobserve } = useIntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        onLoadMore();
      }
    },
    { threshold: 0.1 },
  );

  useEffect(() => {
    const target = sentinelRef.current;
    if (!hasNextPage || isFetching || target == null) {
      return;
    }

    observe(target);

    return () => {
      unobserve(target);
    };
  }, [hasNextPage, isFetching, observe, onLoadMore, unobserve]);

  if (!hasNextPage) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center py-2"
      ref={sentinelRef}
    >
      {isFetching && <Spinner />}
    </div>
  );
}
