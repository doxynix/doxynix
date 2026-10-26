"use client";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";
import { SkeletonList } from "@/shared/ui/kit/app-skeleton";

import { ApiKeyCardSkeleton } from "@/entities/api-key/ui/api-key-card-skeleton";

import { ApiKeysList } from "./api-keys-list";

export function ApiKeysListContainer() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.apikey.list.queryOptions());

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
    <ApiKeysList
      active={data.active}
      archived={data.archived}
    />
  );
}
