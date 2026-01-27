"use client";

import { trpc } from "@/shared/api/trpc";

import { ApiKeyCardSkeleton } from "./api-key-card-skeleton";
import { ApiKeysList } from "./api-keys-list";

export function ApiKeysListContainer() {
  const { data, isLoading } = trpc.apikey.list.useQuery();

  if (isLoading || !data) {
    return <ApiKeyCardSkeleton />;
  }

  return <ApiKeysList active={data.active} archived={data.archived} />;
}
