"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { Spinner } from "@/shared/ui/core/spinner";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AUDIT_LOGS_PAGE_SIZE } from "../model/audit-logs-input";
import { AuditLogList } from "./audit-logs-list";

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
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const allLogs = data?.pages.flatMap((page) => page.items) ?? [];

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
