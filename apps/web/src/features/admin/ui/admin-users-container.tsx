"use client";

import { MAX_PAGE } from "@doxynix/shared";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { adminUserParsers } from "@/entities/user/model/user-parsers";

import { useAdminUserActions } from "../model/use-admin-user-actions";
import { AdminUsersSkeleton } from "./admin-users-skeleton";
import { AdminUsersTable } from "./admin-users-table";
import { AdminUsersToolbar } from "./admin-users-toolbar";

const PAGE_SIZE = 20;

export function AdminUsersContainer() {
  const t = useTranslations("AdminUsers");
  const actions = useAdminUserActions();

  const [filters] = useQueryStates(adminUserParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: MAX_PAGE, min: 1 });

  const { data, isFetching, isLoading } = trpc.adminUser.list.useQuery(
    {
      banned: filters.banned ?? undefined,
      from: filters.from ?? undefined,
      limit: PAGE_SIZE,
      page: safePage,
      role: filters.role ?? undefined,
      search: debouncedSearch || undefined,
      to: filters.to ?? undefined,
    },
    { placeholderData: (previousData) => previousData },
  );

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminUsersToolbar />
        <p className="text-muted-foreground text-sm">
          {t("total_count", { filtered: data.meta.filteredCount, total: data.meta.totalCount })}
        </p>
      </div>

      <AdminUsersTable
        actions={actions}
        users={data.items}
      />

      <AppPagination
        isLoading={isFetching}
        meta={data.meta}
      />
    </div>
  );
}
