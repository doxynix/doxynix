import * as z from "zod";

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
  cursor: z.coerce.number().int().min(1).max(1_000_000).nullish(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(1000).optional(),
});
