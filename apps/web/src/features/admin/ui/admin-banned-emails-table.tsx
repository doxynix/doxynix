"use client";

import { MailX, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { RouterOutput } from "@/shared/api/trpc";
import { formatShortDate } from "@/shared/lib/date-utils";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import type { BannedEmailActions } from "../model/use-banned-email-actions";

type BannedEmailRow = RouterOutput["bannedEmail"]["list"]["items"][number];

type Props = {
  actions: BannedEmailActions;
  entries: BannedEmailRow[];
};

export function AdminBannedEmailsTable({ actions, entries }: Readonly<Props>) {
  const t = useTranslations("AdminBannedEmails");
  const locale = useLocale();

  if (entries.length === 0) {
    return (
      <EmptyState
        description={t("empty_desc")}
        icon={MailX}
        title={t("empty_title")}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("col_email")}</TableHead>
          <TableHead>{t("col_reason")}</TableHead>
          <TableHead>{t("col_created")}</TableHead>
          <TableHead className="text-right">{t("col_actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            className="group"
            key={entry.id}
          >
            <TableCell>
              <span className="font-medium text-sm">{entry.email}</span>
            </TableCell>

            <TableCell>
              <AppBadge variant={entry.reason === "COMPLAINED" ? "destructive" : "secondary"}>
                {t(`reason_${entry.reason.toLowerCase()}`)}
              </AppBadge>
            </TableCell>

            <TableCell className="text-muted-foreground text-sm">
              {formatShortDate(entry.createdAt, locale)}
            </TableCell>

            <TableCell className="text-right">
              <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <AppTooltip content={t("unblock_action")}>
                  <AppButton
                    aria-label={t("unblock_action")}
                    className="text-destructive"
                    onClick={() => actions.remove.mutate({ id: entry.id })}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 />
                  </AppButton>
                </AppTooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
