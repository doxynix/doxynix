"use client";

import type { ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { Card } from "@/shared/ui/core/card";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { UiApiKey } from "../model/api-keys.types";
import { maskApiKey } from "../model/api-keys.utils";

type Props = {
  actions?: ReactNode;
  active: UiApiKey;
  muted?: boolean;
};

export function ApiKeyCard({ actions, active, muted = false }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const locale = useLocale();

  const maskValue = maskApiKey(active.prefix);

  return (
    <Card
      className={cn("group min-w-0", muted && "opacity-70")}
      size="row"
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-tile bg-surface-hover text-muted-foreground">
        <KeyRound className="" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold text-sm">{active.name}</span>
          {active.scopes.map((scope) => (
            <AppBadge
              className="px-1.5 py-0 text-2xs"
              key={scope}
              variant="secondary"
            >
              {scope === "MCP"
                ? t("settings_api_keys_scope_mcp")
                : scope === "CLI"
                  ? t("settings_api_keys_scope_cli")
                  : t("settings_api_keys_scope_full")}
            </AppBadge>
          ))}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-2xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            {tCommon("created")}:
            <TimeAgo
              date={active.createdAt}
              locale={locale}
            />
          </span>
          <span
            aria-hidden={true}
            className="text-border-strong"
          >
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            {t("settings_api_keys_last_used")}:
            {active.lastUsed != null ? (
              <TimeAgo
                date={active.lastUsed}
                locale={locale}
              />
            ) : (
              t("settings_api_keys_last_used_never")
            )}
          </span>
          <span
            aria-hidden={true}
            className="text-border-strong"
          >
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            {t("settings_api_keys_expires")}:
            {active.expiresAt != null ? (
              <TimeAgo
                date={active.expiresAt}
                locale={locale}
              />
            ) : (
              t("settings_api_keys_never_expires")
            )}
          </span>
          {active.revokedAfter != null && (
            <>
              <span
                aria-hidden={true}
                className="text-border-strong"
              >
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-warning">
                {t("settings_api_keys_grace_active")}:
                <TimeAgo
                  date={active.revokedAfter}
                  locale={locale}
                />
              </span>
            </>
          )}
        </div>

        {active.description != null && (
          <p className="truncate text-sm text-muted-foreground">{active.description}</p>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-md border border-border bg-surface-hover/50 px-2 py-1 text-2xs text-muted-foreground">
            {maskValue}
          </span>
        </div>
      </div>

      {actions != null && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-standard group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 not-md:opacity-100 [&_button:focus-visible]:opacity-100">
          {actions}
        </div>
      )}
    </Card>
  );
}
