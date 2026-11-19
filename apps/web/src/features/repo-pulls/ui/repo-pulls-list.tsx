"use client";

import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";

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
      <AppInfiniteSentinel
        hasNextPage={pagination.hasNextPage}
        isFetchingNextPage={pagination.isFetchingNextPage}
        onLoadMore={pagination.onLoadMore}
      />
    </div>
  );
}
