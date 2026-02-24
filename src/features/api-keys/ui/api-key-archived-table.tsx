"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { UiApiKey } from "@/shared/api/trpc";
import { cn, formatRelativeTime } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";

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
      open={isArchivedOpen}
      onOpenChange={setIsArchivedOpen}
      className="bg-card text-card-foreground rounded-lg border shadow-sm"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-medium">{t("settings_api_keys_history_revoked")}</h3>
          <Badge className="ml-1 text-xs">{archived.length}</Badge>
        </div>

        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <ChevronDown
              className={cn(
                "-rotate-90 transition-transform duration-300",
                isArchivedOpen && "rotate-0"
              )}
            />
          </Button>
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
                <TableRow key={key.id} className="opacity-70 hover:opacity-100">
                  <TableCell className="max-w-sm truncate font-medium">{key.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {key.prefix ? `${key.prefix}...` : "..."}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(key.createdAt, locale)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(key.lastUsed, locale)}
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
