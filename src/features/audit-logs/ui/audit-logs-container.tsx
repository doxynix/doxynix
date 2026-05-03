"use client";

import { ChevronDown } from "lucide-react";

import { trpc } from "@/shared/api/trpc";
import { Spinner } from "@/shared/ui/core/spinner";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { AuditLogList } from "./audit-logs-list";

export function AuditLogsContainer() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.audit.getActivityLogs.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  if (isLoading)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  const allLogs = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="bg-card border-border/40 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
      <div className="custom-scrollbar relative flex-1 overflow-auto">
        <AuditLogList logs={allLogs} />

        {hasNextPage && (
          <LoadingButton
            disabled={isFetchingNextPage}
            isLoading={isFetchingNextPage}
            size="sm"
            variant="ghost"
            onClick={() => void fetchNextPage()}
          >
            <ChevronDown /> Load more
          </LoadingButton>
        )}
      </div>
    </div>
  );
}
