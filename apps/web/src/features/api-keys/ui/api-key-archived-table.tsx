"use client";

import { useState } from "react";
import { ChevronDown, HistoryIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { UiApiKey } from "@/entities/api-keys/model/api-keys.types";

type Props = {
  archived: UiApiKey[];
};

export function ApiKeyArchivedTable({ archived }: Readonly<Props>) {
  const locale = useLocale();
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  return (
    <Collapsible
      className="rounded-lg border bg-card text-card-foreground"
      onOpenChange={setIsArchivedOpen}
      open={isArchivedOpen}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="text-muted-foreground" />
          <h3 className="font-medium text-sm">{t("settings_api_keys_history_revoked")}</h3>
          <AppBadge className="ml-1 text-xs">{archived.length}</AppBadge>
        </div>

        <CollapsibleTrigger asChild>
          <AppButton className="size-8 p-0" size="sm" variant="ghost">
            <ChevronDown className={cn("-rotate-90", isArchivedOpen && "rotate-0")} />
          </AppButton>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{tCommon("title")}</TableHead>
                <TableHead>{t("settings_api_keys_prefix")}</TableHead>
                <TableHead>{tCommon("created")}</TableHead>
                <TableHead>{t("settings_api_keys_last_used")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archived.map((key) => (
                <TableRow className="opacity-70 hover:opacity-100" key={key.id}>
                  <TableCell className="max-w-sm truncate font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    {key.prefix.length > 0 ? `${key.prefix}...` : "..."}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <TimeAgo date={key.createdAt} locale={locale} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <TimeAgo date={key.lastUsed ?? ""} locale={locale} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
