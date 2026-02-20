"use client";

import { useSearchParams } from "next/navigation";
import type { Status } from "@prisma/client";
import { useTranslations } from "next-intl";

import { trpc } from "@/shared/api/trpc";
import { parseRepoSearchParams } from "@/shared/lib/search-params";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { RepoCardSkeleton } from "@/entities/repo";
import { RepoList } from "./repo-list";

type Props = {
  config?: {
    limit?: number;
    showPagination?: boolean;
    showTotalCount?: boolean;
    forcedFilters?: {
      sortBy?: "updatedAt" | "createdAt" | "name";
      sortOrder?: "asc" | "desc";
      status?: Status;
      owner?: string;
    };
  };
};

export function RepoListContainer({ config }: Props) {
  const searchParams = useSearchParams();
  const t = useTranslations("Dashboard");

  const rawParams = Object.fromEntries(searchParams.entries());
  const params = parseRepoSearchParams(rawParams);

  const limit = config?.limit ?? 5;
  const page = config?.showPagination === false ? 1 : params.page;

  const filters = {
    ...params,
    ...config?.forcedFilters,
    limit,
    cursor: page,
  };

  const { data, isLoading } = trpc.repo.getAll.useQuery(filters, {
    placeholderData: (previousData) => previousData,
  });

  if (isLoading || !data) {
    return (
      <>
        {config?.showTotalCount !== false && <Skeleton className="mb-4 ml-auto h-5 w-24 text-sm" />}
        <RepoCardSkeleton count={limit} />
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
      <RepoList repos={items} meta={meta} />

      {config?.showPagination !== false && <AppPagination className="mt-auto" meta={meta} />}
    </>
  );
}
