"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { trpc } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import type { RepoStatus } from "@/entities/repo/model/repo.types";
import { repoParsers } from "@/entities/repo/model/repo-parsers";
import { RepoCardSkeleton } from "@/entities/repo/ui/repo-card-skeleton";

import { RepoList } from "./repo-list";

type Props = {
  config?: {
    forcedFilters?: {
      owner?: string;
      sortBy?: "createdAt" | "name" | "updatedAt";
      sortOrder?: "asc" | "desc";
      status?: RepoStatus;
    };
    limit?: number;
    showPagination?: boolean;
    showTotalCount?: boolean;
  };
};

export function RepoListContainer({ config }: Readonly<Props>) {
  const t = useTranslations("Dashboard");

  const [filters] = useQueryStates(repoParsers);

  const debouncedSearch = useDebounce(filters.search, 500);

  const safeLimit = clampIntegerParam(config?.limit, { fallback: 5, max: 100, min: 1 });
  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: 1_000_000, min: 1 });

  const queryParams = {
    cursor: safePage,
    limit: safeLimit,
    search: debouncedSearch || undefined,
    sortBy: filters.sortBy,
    status: filters.status ?? undefined,
    visibility: filters.visibility ?? undefined,
    ...config?.forcedFilters,
  };

  const { data, isFetching, isLoading } = trpc.repo.getAll.useQuery(queryParams, {
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || data == null) {
    return (
      <>
        {config?.showTotalCount !== false && <Skeleton className="mb-4 ml-auto h-5 w-24 text-sm" />}
        <div className="flex flex-col gap-3">
          {Array.from({ length: safeLimit }).map((_, i) => (
            <RepoCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  const { items, meta } = data;

  return (
    <>
      {config?.showTotalCount !== false && (
        <div className="mb-4 text-muted-foreground text-sm">
          <p className="text-center xs:text-right">
            {t("repo_total_count", {
              filteredCount: meta.filteredCount,
              totalCount: meta.totalCount,
            })}
          </p>
        </div>
      )}
      <div className="flex-1">
        <RepoList meta={meta} repos={items} />
      </div>

      {config?.showPagination !== false && (
        <AppPagination className="mt-4" isLoading={isFetching} meta={meta} />
      )}
    </>
  );
}
