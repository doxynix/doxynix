import * as z from "zod";

const MAX_PAGE = 1_000_000;

export function clampPage(cursor: null | number | undefined): number {
  return Math.min(Math.max(1, cursor ?? 1), MAX_PAGE);
}

export function getPaginationMeta(params: {
  filteredCount: number;
  limit: number;
  page: number;
  search?: string;
  totalCount: number;
}) {
  if (!Number.isInteger(params.limit) || params.limit <= 0) {
    throw new Error("Pagination limit must be a positive integer");
  }
  if (!Number.isInteger(params.page) || params.page <= 0) {
    throw new Error("Pagination page must be a positive integer");
  }

  const totalPages = Math.max(1, Math.ceil(params.filteredCount / params.limit));

  return {
    currentPage: params.page,
    filteredCount: params.filteredCount,
    nextCursor: params.page < totalPages ? params.page + 1 : undefined,
    pageSize: params.limit,
    searchQuery: params.search,
    totalCount: params.totalCount,
    totalPages,
  };
}

export const PaginationSchema = z.object({
  cursor: z.coerce.number().int().min(1).max(MAX_PAGE).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(1000).optional(),
});
