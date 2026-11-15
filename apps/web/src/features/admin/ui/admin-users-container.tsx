"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { AppInfiniteSentinel } from "@/shared/ui/kit/app-infinite-sentinel";

import { adminUserParsers } from "@/entities/user/model/user-parsers";

import { useAdminUserActions } from "../model/use-admin-user-actions";
import { AdminUsersSkeleton } from "./admin-users-skeleton";
import { AdminUsersTable } from "./admin-users-table";
import { AdminUsersToolbar } from "./admin-users-toolbar";

const PAGE_SIZE = 20;

export function AdminUsersContainer() {
  const trpc = useTRPC();
  const actions = useAdminUserActions();

  const [filters] = useQueryStates(adminUserParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.adminUser.list.infiniteQueryOptions(
      {
        banned: filters.banned ?? undefined,
        from: filters.from ?? undefined,
        limit: PAGE_SIZE,
        role: filters.role ?? undefined,
        search: debouncedSearch || undefined,
        to: filters.to ?? undefined,
      },
      { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
    ),
  );

  const users = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading || data == null) {
    return (
      <div className="flex flex-col gap-4">
        <AdminUsersToolbar />
        <AdminUsersSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminUsersToolbar />

      <AdminUsersTable
        actions={actions}
        users={users}
      />

      <AppInfiniteSentinel
        hasNextPage={hasNextPage}
        isFetching={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}
