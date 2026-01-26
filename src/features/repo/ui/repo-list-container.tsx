import { Status } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { parseRepoSearchParams } from "@/shared/lib/search-params";
import { AppPagination } from "@/shared/ui/kit/app-pagination";

import { api } from "@/server/trpc/server";
import { RepoList } from "./repo-list";

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
  const rawParams = (await searchParams) ?? {};
  const t = await getTranslations("Dashboard");

  const params = parseRepoSearchParams(rawParams);

  const limit = config?.limit ?? 5;
  const page = config?.showPagination === false ? 1 : params.page;

  const filters = {
    ...params,
    ...config?.forcedFilters,
    limit,
    cursor: page,
  };

  const { items, meta } = await (await api()).repo.getAll(filters);

  return (
    <>
      {config?.showTotalCount !== false && (
        <div className="text-muted-foreground my-4 text-sm">
          <div className="xs:text-right text-center">
            {t("repo_total_count", {
              filteredCount: meta.filteredCount,
              totalCount: meta.totalCount,
            })}
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
