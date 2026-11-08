"use client";

import type { PRAnalysisStatus } from "@doxynix/shared";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { TimeAgo } from "@/shared/ui/kit/time-ago";

import type { PrDetailItem } from "../model/pr-details";

type StatusConfig = Record<PRAnalysisStatus, { className: string; label: string }>;

type Props = {
  items: PrDetailItem[];
  title: string;
};

export function PrDetailsSummary({ items, title }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const statusConfig: StatusConfig = {
    ANALYZING: { className: "text-foreground", label: t("repo_pull_status_analyzing") },
    COMPLETED: { className: "text-success", label: t("repo_pull_status_completed") },
    FAILED: { className: "text-destructive", label: tCommon("failed") },
    PENDING: { className: "text-warning", label: t("repo_pull_status_pending") },
  };

  const renderValue = (item: PrDetailItem) => {
    switch (item.kind) {
      case "copy": {
        return (
          <>
            <CopyButton
              className="opacity-100"
              tooltipText={t("repo_pull_copy_sha")}
              value={item.value}
            />
            <span className={cn("font-medium text-xs")}>
              {item.value.slice(0, 7) || t("repo_pull_na")}
            </span>
          </>
        );
      }
      case "number": {
        return <span className={cn("font-medium text-xs")}>{item.value}</span>;
      }
      case "status": {
        if (item.value == null) {
          return <span className={cn("font-medium text-xs")}>{t("repo_pull_na")}</span>;
        }

        const config = statusConfig[item.value];

        return <span className={cn("font-bold", config.className)}>{config.label}</span>;
      }
      case "time": {
        if (item.value == null) {
          return <span className={cn("font-medium text-xs")}>{t("repo_pull_na")}</span>;
        }

        return (
          <TimeAgo
            date={item.value}
            locale={locale}
          />
        );
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {items.map((item) => (
          <div
            className="flex items-baseline justify-between"
            key={item.label}
          >
            <span className="min-w-0 truncate text-muted-foreground text-xs">{item.label}:</span>
            <div className="flex shrink-0 items-center gap-1">{renderValue(item)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
