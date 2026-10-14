"use client";

import { MAX_PAGE } from "@doxynix/shared";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { adminReviewParsers } from "../model/admin-review-parsers";
import { AdminReviewSkeleton } from "./admin-review-skeleton";
import { AdminReviewTable } from "./admin-review-table";
import { AdminReviewToolbar } from "./admin-review-toolbar";

const PAGE_SIZE = 20;

export function AdminReviewContainer() {
  const t = useTranslations("AdminReview");

  const [filters] = useQueryStates(adminReviewParsers);
  const debouncedSearch = useDebounce(filters.search, 500);

  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: MAX_PAGE, min: 1 });

  const { data, isFetching, isLoading } = trpc.adminReview.list.useQuery(
    {
      fixStatus: filters.fixStatus ?? undefined,
      from: filters.from ?? undefined,
      limit: PAGE_SIZE,
      minRiskScore:
        filters.minRiskScore == null ? undefined : Number.parseInt(filters.minRiskScore, 10),
      page: safePage,
      search: debouncedSearch || undefined,
      status: filters.status ?? undefined,
      to: filters.to ?? undefined,
    },
    { placeholderData: (previousData) => previousData },
  );

  if (isLoading || data == null) {
    return (
      <div className="flex flex-col gap-4">
        <AdminReviewToolbar />
        <AdminReviewSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminReviewToolbar />
        <p className="text-muted-foreground text-sm">
          {t("total_count", { filtered: data.meta.filteredCount, total: data.meta.totalCount })}
        </p>
      </div>

      <AdminReviewTable reviews={data.items} />

      <AppPagination
        isLoading={isFetching}
        meta={data.meta}
      />
    </div>
  );
}
