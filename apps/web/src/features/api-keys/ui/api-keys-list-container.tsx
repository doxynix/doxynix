"use client";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

import { ApiKeyCardSkeleton } from "@/entities/api-key/ui/api-key-card-skeleton";

import { ApiKeysList } from "./api-keys-list";

export function ApiKeysListContainer() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.apikey.list.queryOptions());

  if (isLoading || data == null) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ApiKeyCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <ApiKeysList
      active={data.active}
      archived={data.archived}
    />
  );
}
