"use client";

import { useLocale, useTranslations } from "next-intl";

import { formatRelativeTime } from "@/shared/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { UiApiKey } from "@/entities/api-keys";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";
import { UpdateApiKeyDialog } from "./update-api-key-dialog";

export function ApiKeyCard({ active }: { active: UiApiKey }) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  return (
    <Card className="group justify-between">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1 overflow-hidden">
          <CardTitle className="truncate text-base font-semibold">{active.name}</CardTitle>
          <CardDescription className="flex flex-col gap-2 text-xs">
            <p>
              {tCommon("created")}: {formatRelativeTime(active.createdAt, locale)}
            </p>
            <p>
              {t("settings_api_keys_last_used")}: {formatRelativeTime(active.lastUsed, locale)}
            </p>
            {active.description != null && (
              <p className="text-muted-foreground line-clamp-4 leading-relaxed">
                {active.description}
              </p>
            )}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <CopyButton value={active.id} className="h-9 w-9" />
          <UpdateApiKeyDialog apiKey={active} />
          <RevokeApiKeyDialog apiKey={active} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted text-muted-foreground truncate rounded-xl p-2 font-mono text-xs">
          {active.prefix != null && active.prefix !== ""
            ? `${active.prefix}••••••••••••••••••••••••••••••••••••••••••••••••••••`
            : "dxnx_••••••••••••••••••••••••••••••••••••••••••••••••••••"}
        </div>
      </CardContent>
    </Card>
  );
}
