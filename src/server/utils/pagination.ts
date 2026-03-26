import { z } from "zod";

export const PaginationMetaSchema = z.object({
  currentPage: z.number().int(),
  filteredCount: z.number().int(),
  nextCursor: z.number().int().optional(),
  pageSize: z.number().int(),
  searchQuery: z.string().optional(),
  totalCount: z.number().int(),
  totalPages: z.number().int(),
});

export function getPaginationMeta(params: {
  filteredCount: number;
  limit: number;
  page: number;
  search?: string;
  totalCount: number;
}) {
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
