"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, CircleOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Table, TableHead, TableHeader, TableRow } from "@/shared/ui/core/table";
import type { SkeletonColumn } from "@/shared/ui/kit/app-skeleton";
import { SkeletonTableBody, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AUDIT_LOGS_PAGE_SIZE } from "../model/audit-logs-input";
import { AuditLogList } from "./audit-logs-list";

const COLUMNS: SkeletonColumn[] = [
  {
    className: "py-4",
    render: () => (
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-lg size-8" />
        <SkeletonText
          lines={1}
          widths={["w-32"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-24"]}
      />
    ),
    width: "w-24",
  },
  {
    render: () => (
      <SkeletonText
        lines={1}
        widths={["w-48"]}
      />
    ),
    width: "w-16",
  },
  {
    render: () => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5" />
          <SkeletonText
            lines={1}
            size="sm"
            widths={["w-24"]}
          />
        </div>
        <SkeletonText
          lines={1}
          size="sm"
          widths={["w-32"]}
        />
      </div>
    ),
    width: "w-16",
  },
  {
    className: "whitespace-nowrap text-right",
    render: () => (
      <SkeletonText
        lines={1}
        size="sm"
        widths={["w-16"]}
      />
    ),
    width: "w-16",
  },
  {
    className: "text-center",
    render: () => <Skeleton className="rounded-xl size-9" />,
    width: "w-16",
  },
];

export function AuditLogsContainer() {
  const trpc = useTRPC();
  const t = useTranslations("AuditLogs");
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.audit.getActivityLogs.infiniteQueryOptions(
      { limit: AUDIT_LOGS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="custom-scrollbar relative flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col_event")}</TableHead>
                <TableHead>{t("col_entity")}</TableHead>
                <TableHead>{t("col_target")}</TableHead>
                <TableHead>{t("col_source")}</TableHead>
                <TableHead className="text-right">{t("col_time")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <SkeletonTableBody
              columns={COLUMNS}
              rows={8}
            />
          </Table>
        </div>
      </div>
    );
  }

  const allLogs = data?.pages.flatMap((page) => page.items) ?? [];

  if (allLogs.length === 0) {
    return (
      <EmptyState
        description={t("empty_desc")}
        icon={CircleOff}
        title={t("empty_title")}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="custom-scrollbar relative flex-1 overflow-auto">
        <AuditLogList logs={allLogs} />

        {hasNextPage && (
          <LoadingButton
            className="flex w-full items-center justify-center rounded-t-none"
            disabled={isFetchingNextPage}
            isLoading={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            size="sm"
            variant="ghost"
          >
            <ChevronDown /> {t("load_more")}
          </LoadingButton>
        )}
      </div>
    </div>
  );
}
