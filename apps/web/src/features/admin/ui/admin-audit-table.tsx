"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import {
  Cpu,
  Database,
  Ghost,
  GitPullRequest,
  Key,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
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
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { EmptyState } from "@/shared/ui/kit/empty-state";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { AdminAuditEntry } from "../model/admin-audit.types";
import { AdminAuditPayloadSheet } from "./admin-audit-payload-sheet";

const DEVICE_ICONS: Partial<
  Record<AdminAuditEntry["deviceType"], ComponentType<{ className?: string }>>
> = {
  desktop: Monitor,
  mobile: Smartphone,
  system: Cpu,
  tablet: Tablet,
};

const MODEL_ICONS: Partial<Record<string, ComponentType<{ className?: string }>>> = {
  analysis: RefreshCw,
  database: Database,
  ghost: Ghost,
  "git-pr": GitPullRequest,
  github: GitHubIcon,
  key: Key,
  shield: ShieldCheck,
  user: User,
};

type Props = {
  logs: AdminAuditEntry[];
};

export function AdminAuditTable({ logs }: Readonly<Props>) {
  const t = useTranslations("AdminAudit");

  if (logs.length === 0) {
    return (
      <EmptyState
        description={t("empty_desc")}
        icon={Database}
        title={t("empty_title")}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("col_action")}</TableHead>
          <TableHead>{t("col_entity")}</TableHead>
          <TableHead>{t("col_target")}</TableHead>
          <TableHead>{t("col_origin")}</TableHead>
          <TableHead className="text-right">{t("col_created")}</TableHead>
          <TableHead className="text-center">{t("col_payload")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <AdminAuditRow
            key={log.id}
            log={log}
          />
        ))}
      </TableBody>
    </Table>
  );
}

type RowProps = {
  log: AdminAuditEntry;
};

function AdminAuditRow({ log }: Readonly<RowProps>) {
  const locale = useLocale();
  const t = useTranslations("AdminAudit");
  const [sheetOpen, setSheetOpen] = useState(false);

  const Icon = MODEL_ICONS[log.iconKey] ?? Database;
  const DeviceIcon = DEVICE_ICONS[log.deviceType] ?? Monitor;
  const reason = log.details?.find((detail) => detail.label === "ban reason")?.value;

  return (
    <TableRow
      className="group"
      data-testid={`audit-row-${log.id}`}
    >
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-8 items-center justify-center rounded-lg border")}>
            <Icon className="size-4" />
          </div>
          <span>{t(`operation_${log.actionTitle.toLowerCase()}`)}</span>
        </div>
      </TableCell>

      <TableCell>
        <AppBadge variant="secondary">{log.entityType}</AppBadge>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="block max-w-75 truncate text-sm">{log.targetName}</span>
          {reason != null && (
            <span className="max-w-75 truncate text-muted-foreground text-xs">{reason}</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1.5 text-muted-foreground text-xs">
          <div className="flex items-center gap-2">
            <DeviceIcon />
            <span>{log.ip ?? t("origin_system")}</span>
          </div>
          <span className="max-w-40 truncate">{log.browser}</span>
        </div>
      </TableCell>

      <TableCell className="whitespace-nowrap text-right">
        <TimeAgo
          className="text-xs hover:text-foreground"
          date={log.createdAt}
          locale={locale}
        />
      </TableCell>

      <TableCell className="text-center">
        <AppButton
          aria-label={t("detail_title")}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setSheetOpen(true)}
          size="icon"
          variant="ghost"
        >
          <Database className="text-muted-foreground hover:text-foreground" />
        </AppButton>
      </TableCell>

      <AdminAuditPayloadSheet
        logId={log.id}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
      />
    </TableRow>
  );
}
