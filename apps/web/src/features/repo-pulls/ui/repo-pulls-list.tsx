"use client";

import { useEffect, useRef } from "react";

import { useIntersectionObserver } from "@/shared/lib/hooks/use-intersection-observer";
import { Spinner } from "@/shared/ui/core/spinner";

import type { RepoPull } from "@/entities/pr/model/pr.types";
import { RepoPullCard } from "@/entities/pr/ui/repo-pull-card";

export type PullsPagination = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => Promise<unknown>;
};

type Props = {
  name: string;
  owner: string;
  pagination: PullsPagination;
  pulls: RepoPull[];
};

export function RepoPullsList({ name, owner, pagination, pulls }: Readonly<Props>) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { observe, unobserve } = useIntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        void pagination.onLoadMore();
      }
    },
    { threshold: 0.1 },
  );

  useEffect(() => {
    const target = sentinelRef.current;
    if (!pagination.hasNextPage || pagination.isFetchingNextPage || target == null) {
      return;
    }

    observe(target);

    return () => {
      unobserve(target);
    };
  }, [
    pagination.hasNextPage,
    pagination.isFetchingNextPage,
    pagination.onLoadMore,
    observe,
    unobserve,
  ]);

  return (
    <div className="flex flex-col gap-3">
      {pulls.map((pull) => (
        <RepoPullCard
          key={pull.id}
          name={name}
          owner={owner}
          pull={pull}
        />
      ))}
      {pagination.hasNextPage && (
        <div
          className="flex items-center justify-center py-2"
          ref={sentinelRef}
        >
          {pagination.isFetchingNextPage && <Spinner />}
        </div>
      )}
    </div>
  );
}
