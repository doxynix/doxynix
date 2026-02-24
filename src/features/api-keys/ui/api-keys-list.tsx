"use client";

import type { UiApiKey } from "@/shared/api/trpc";

import { ApiKeyArchivedTable } from "./api-key-archived-table";
import { ApiKeyCard } from "./api-key-card";
import { ApiKeysEmpty } from "./api-keys-empty";

type Props = {
  active: UiApiKey[];
  archived: UiApiKey[];
};

export function ApiKeysList({ active, archived }: Readonly<Props>) {
  return (
    <div className="flex w-full flex-col gap-6">
      {active.length === 0 ? (
        <ApiKeysEmpty />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {active.map((key) => (
            <ApiKeyCard key={key.id} active={key} />
          ))}
        </div>
      )}
      {archived.length > 0 && <ApiKeyArchivedTable archived={archived} />}
    </div>
  );
}
