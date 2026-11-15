"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";

import { adminAuditParsers } from "@/entities/audit-log/model/audit-parsers";

import { AdminAuditSkeleton } from "./admin-audit-skeleton";
import { AdminAuditTable } from "./admin-audit-table";
import { AdminAuditToolbar } from "./admin-audit-toolbar";

const PAGE_SIZE = 20;

export function AdminAuditContainer() {
  const trpc = useTRPC();
  const [filters] = useQueryStates(adminAuditParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.adminAudit.list.infiniteQueryOptions(
      {
        from: filters.from ?? undefined,
        limit: PAGE_SIZE,
        model: filters.model ?? undefined,
        operation: filters.operation ?? undefined,
        search: debouncedSearch || undefined,
        to: filters.to ?? undefined,
      },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const logs = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading || data == null) {
    return (
      <div className="flex flex-col gap-4">
        <AdminAuditToolbar />
        <AdminAuditSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminAuditToolbar />

      <AdminAuditTable logs={logs} />

      <AppInfiniteSentinel
        hasNextPage={hasNextPage}
        isFetching={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}
