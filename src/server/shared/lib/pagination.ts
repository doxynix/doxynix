import { z } from "zod";

export const PaginationMetaSchema = z.object({
  currentPage: z.number().int().min(1),
  filteredCount: z.number().int().min(0),
  nextCursor: z.number().int().optional(),
  pageSize: z.number().int().positive(),
  searchQuery: z.string().optional(),
  totalCount: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

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

export type PaginationMeta = ReturnType<typeof getPaginationMeta>;
