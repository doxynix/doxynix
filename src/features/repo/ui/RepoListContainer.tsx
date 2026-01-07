import type { Status, Visibility } from "@prisma/client";

import { AppPagination } from "@/shared/ui/AppPagination";
import { RepoList } from "@/features/repo";

import { api } from "@/server/trpc/server";

type SearchParams = { [key: string]: string | string[] | undefined };

type Props = {
  searchParams?: Promise<SearchParams> | SearchParams;
  config?: {
    limit?: number;
    showPagination?: boolean;
    showTotalCount?: boolean;
    forcedFilters?: {
      sortBy?: "updatedAt" | "createdAt" | "name";
      sortOrder?: "asc" | "desc";
      status?: Status;
    };
  };
};

export async function RepoListContainer({ searchParams, config }: Props) {
  const params = (await searchParams) ?? {};
  const limit = config?.limit ?? 5;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = config?.showPagination === false ? 1 : Number(pageParam) || 1;
  const searchParam = Array.isArray(params.search) ? params.search[0] : params.search;
  const search = searchParam ?? "";

  const sortByParam = Array.isArray(params.sortBy) ? params.sortBy[0] : params.sortBy;
  const sortBy =
    config?.forcedFilters?.sortBy ??
    ((sortByParam as "updatedAt" | "createdAt" | "name") || "updatedAt");

  const sortOrderParam = Array.isArray(params.sortOrder) ? params.sortOrder[0] : params.sortOrder;
  const sortOrder =
    config?.forcedFilters?.sortOrder ?? ((sortOrderParam as "asc" | "desc") || "desc");

  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = config?.forcedFilters?.status ?? (statusParam as Status | undefined);

  const visibilityParam = Array.isArray(params.visibility)
    ? params.visibility[0]
    : params.visibility;
  const visibility = visibilityParam as Visibility | undefined;

  const { items, meta } = await (
    await api()
  ).repo.getAll({
    cursor: page,
    limit,
    search,
    status,
    visibility,
    sortBy,
    sortOrder,
  });

  return (
    <>
      {config?.showTotalCount !== false && (
        <div className="text-muted-foreground my-4 text-sm">
          <div className="text-right">
            Показано: {meta.filteredCount} из {meta.totalCount}
          </div>
        </div>
      )}
      <RepoList repos={items} meta={meta} />

      {config?.showPagination !== false && (
        <AppPagination
          className="mt-auto"
          currentPage={meta.currentPage}
          totalPages={meta.totalPages}
        />
      )}
    </>
  );
}
