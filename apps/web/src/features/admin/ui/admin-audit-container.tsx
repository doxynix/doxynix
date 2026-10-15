"use client";
import { MAX_PAGE } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { adminAuditParsers } from "@/entities/audit-log/model/audit-parsers";

import { AdminAuditSkeleton } from "./admin-audit-skeleton";
import { AdminAuditTable } from "./admin-audit-table";
import { AdminAuditToolbar } from "./admin-audit-toolbar";

const PAGE_SIZE = 20;

export function AdminAuditContainer() {
  const trpc = useTRPC();
  const t = useTranslations("AdminAudit");

  const [filters] = useQueryStates(adminAuditParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: MAX_PAGE, min: 1 });

  const { data, isFetching, isLoading } = useQuery(
    trpc.adminAudit.list.queryOptions(
      {
        from: filters.from ?? undefined,
        limit: PAGE_SIZE,
        model: filters.model ?? undefined,
        operation: filters.operation ?? undefined,
        page: safePage,
        search: debouncedSearch || undefined,
        to: filters.to ?? undefined,
      },
      { placeholderData: (previousData) => previousData },
    ),
  );

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminAuditToolbar />
        <p className="text-muted-foreground text-sm">
          {t("total_count", { filtered: data.meta.filteredCount, total: data.meta.totalCount })}
        </p>
      </div>

      <AdminAuditTable logs={data.items} />

      <AppPagination
        isLoading={isFetching}
        meta={data.meta}
      />
    </div>
  );
}
