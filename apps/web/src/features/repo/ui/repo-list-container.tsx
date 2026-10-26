"use client";
import { MAX_PAGE, MAX_PAGE_SIZE } from "@doxynix/shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { clampIntegerParam } from "@/shared/lib/number-utils";
import { AppPagination } from "@/shared/ui/kit/app-pagination";
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";

import type { RepoStatus } from "@/entities/repo/model/repo.types";
import { REPO_LIST_DEFAULT_LIMIT, repoParsers } from "@/entities/repo/model/repo-parsers";
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
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");

  const [filters] = useQueryStates(repoParsers);

  const debouncedSearch = useDebounce(filters.search, 500);

  const safeLimit = clampIntegerParam(config?.limit, {
    fallback: REPO_LIST_DEFAULT_LIMIT,
    max: MAX_PAGE_SIZE,
    min: 1,
  });
  const safePage = clampIntegerParam(filters.page, { fallback: 1, max: MAX_PAGE, min: 1 });

  const queryParams = {
    from: filters.from ?? undefined,
    limit: safeLimit,
    page: safePage,
    search: debouncedSearch || undefined,
    sortBy: filters.sortBy,
    status: filters.status ?? undefined,
    to: filters.to ?? undefined,
    visibility: filters.visibility ?? undefined,
    ...config?.forcedFilters,
  };

  const { data, isFetching, isLoading } = useQuery(
    trpc.repo.getAll.queryOptions(queryParams, {
      placeholderData: (previousData) => previousData,
    }),
  );

  if (isLoading || data == null) {
    return (
      <>
        {config?.showTotalCount !== false && (
          <div className="mb-4">
            <SkeletonText
              lines={1}
              size="lg"
              widths={["w-24"]}
            />
          </div>
        )}
        <SkeletonList
          className="flex flex-col gap-3"
          count={safeLimit}
          renderItem={() => <RepoCardSkeleton />}
        />
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
        <RepoList
          meta={meta}
          repos={items}
        />
      </div>

      {config?.showPagination !== false && (
        <AppPagination
          className="mt-4"
          isLoading={isFetching}
          meta={meta}
        />
      )}
    </>
  );
}
