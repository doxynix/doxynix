import { MAX_PAGE, MAX_PAGE_SIZE } from "@doxynix/shared";
import * as z from "zod";

export function clampPage(page: null | number | undefined): number {
  return Math.min(Math.max(1, page ?? 1), MAX_PAGE);
}

export function getPaginationMeta(params: {
  capped?: boolean;
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
    ...(params.capped === true ? { capped: true as const } : {}),
    currentPage: params.page,
    filteredCount: params.filteredCount,
    hasNextPage: params.page < totalPages,
    pageSize: params.limit,
    searchQuery: params.search,
    totalCount: params.totalCount,
    totalPages,
  };
}

export const DateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((data) => data.from == null || data.to == null || data.from <= data.to, {
    message: "The start of the range must not be after its end",
    path: ["from"],
  });

export const dateRangeMustBeOrdered = (
  data: { from?: Date | null; to?: Date | null },
  ctx: z.RefinementCtx,
) => {
  if (data.from != null && data.to != null && data.from > data.to) {
    ctx.addIssue({
      code: "custom",
      message: "The start of the range must not be after its end",
      path: ["from"],
    });
  }
};

export type DateRangeInput = z.infer<typeof DateRangeSchema>;

export function buildDateRangeWhere(
  range: { from?: Date | null; to?: Date | null },
  column: "createdAt" | "updatedAt",
): Record<string, { gte?: Date; lte?: Date }> {
  if (range.from == null && range.to == null) {
    return {};
  }

  return {
    [column]: {
      ...(range.from != null ? { gte: range.from } : {}),
      ...(range.to != null ? { lte: range.to } : {}),
    },
  };
}

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
  page: z.coerce.number().int().min(1).nullish(),
  search: z.string().trim().max(1000).optional(),
});

export const CursorSchema = z.object({
  cursor: z.uuid().nullish(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
  search: z.string().trim().max(1000).optional(),
});

export const ORDER_CREATED_AT_DESC = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export function keysetArgs(cursor: null | string | undefined, limit: number) {
  return {
    cursor: cursor != null ? { id: cursor } : undefined,
    take: limit + 1,
  };
}

export function splitKeysetPage<TItem extends { id: string }>(rows: TItem[], limit: number) {
  const hasNextPage = rows.length > limit;
  const probe = hasNextPage ? rows.at(-1) : undefined;

  // The probe row is not returned: it becomes the next cursor, and since the cursor is
  // inclusive it comes back as the first row of the next page.
  return {
    hasNextPage,
    items: hasNextPage ? rows.slice(0, -1) : rows,
    nextCursor: probe?.id,
  };
}

export const orderWithTiebreak = <TColumn extends string>(
  column: TColumn,
  direction: "asc" | "desc",
): [{ [K in TColumn]: "asc" | "desc" }, { id: "asc" | "desc" }] => [
  { [column]: direction } as { [K in TColumn]: "asc" | "desc" },
  { id: direction },
];

export type PaginationMeta = ReturnType<typeof getPaginationMeta>;

export async function cappedCount(
  fetchIds: (cap: number) => PromiseLike<readonly unknown[]>,
  cap: number,
): Promise<number> {
  const rows = await fetchIds(cap);
  return rows.length;
}

export async function getPaginatedList<TItem>(params: {
  countCap: number;
  countFiltered: () => PromiseLike<number>;
  countUnfiltered: (() => PromiseLike<number>) | null;
  fetchItems: (range: { skip: number; take: number }) => Promise<TItem[]>;
  input: { limit: number; page?: null | number; search?: string };
}): Promise<{ items: TItem[]; meta: PaginationMeta }> {
  const page = clampPage(params.input.page);
  const skip = (page - 1) * params.input.limit;

  const [items, filteredCount, unfilteredCount] = await Promise.all([
    params.fetchItems({ skip, take: params.input.limit }),
    params.countFiltered(),
    params.countUnfiltered?.() ?? null,
  ]);

  return {
    items,
    meta: getPaginationMeta({
      capped: filteredCount >= params.countCap,
      filteredCount,
      limit: params.input.limit,
      page,
      ...(params.input.search != null ? { search: params.input.search } : {}),
      totalCount: unfilteredCount ?? filteredCount,
    }),
  };
}
