"use client";

import { trpc } from "@/shared/api/trpc";

import { ApiKeyCardSkeleton } from "./api-key-card-skeleton";
import { ApiKeysList } from "./api-keys-list";

export function ApiKeysListContainer() {
  const { data, isLoading } = trpc.apikey.list.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ApiKeyCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <ApiKeysList active={data.active} archived={data.archived} />;
}
