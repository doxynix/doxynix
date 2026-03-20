"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useDebounce } from "use-debounce";

import { trpc, type RepoStatus } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { RepoCardSkeleton, repoParsers } from "@/entities/repo";

import { RepoList } from "./repo-list";

type Props = {
  config?: {
    forcedFilters?: {
      owner?: string;
      sortBy?: "updatedAt" | "createdAt" | "name";
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

  const [debouncedSearch] = useDebounce(filters.search, 500);

  const limit = config?.limit ?? 5;

  const queryParams = {
    cursor: filters.page,
    limit,
    search: debouncedSearch || undefined,
    sortBy: filters.sortBy,
    status: filters.status ?? undefined,
    visibility: filters.visibility ?? undefined,
    ...config?.forcedFilters,
  };

  const { data, isFetching, isLoading } = trpc.repo.getAll.useQuery(queryParams, {
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || !data) {
    return (
      <>
        {config?.showTotalCount !== false && <Skeleton className="mb-4 ml-auto h-5 w-24 text-sm" />}
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
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
        <div className="text-muted-foreground mb-4 text-sm">
          <p className="xs:text-right text-center">
            {t("repo_total_count", {
              filteredCount: meta.filteredCount,
              totalCount: meta.totalCount,
            })}
          </p>
        </div>
      )}
      <div className={isFetching ? "opacity-50" : ""}>
        <RepoList meta={meta} repos={items} />
      </div>

      {config?.showPagination !== false && (
        <AppPagination isLoading={isFetching} meta={meta} className="mt-4" />
      )}
    </>
  );
}
