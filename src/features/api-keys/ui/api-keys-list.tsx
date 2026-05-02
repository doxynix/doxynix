"use client";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { UiApiKey } from "@/entities/api-keys/model/api-keys.types";
import { ApiKeyCard } from "@/entities/api-keys/ui/api-key-card";

import { ApiKeyArchivedTable } from "./api-key-archived-table";

type Props = {
  active: UiApiKey[];
  archived: UiApiKey[];
};

export function ApiKeysList({ active, archived }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  return (
    <div className="flex w-full flex-col gap-6">
      {active.length === 0 ? (
        <EmptyState
          description={t("settings_api_keys_empty_desc")}
          title={t("settings_api_keys_empty_title")}
        />
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
