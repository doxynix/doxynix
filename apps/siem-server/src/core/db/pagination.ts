import type { PaginatedResponse } from "@doxynix/siem-shared";
import { db } from "@server/core/db/db";
import { count, type SQL, type Table } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

type PaginateQueryOptions<TTable extends PgTable> = {
  table: TTable;
  whereClause?: SQL;
  orderBy: SQL[];
  page: number;
  limit: number;
};

export async function executePaginatedQuery<TTable extends PgTable>({
  table,
  whereClause,
  orderBy,
  page,
  limit,
}: PaginateQueryOptions<TTable>): Promise<PaginatedResponse<TTable["$inferSelect"]>> {
  const offset = (page - 1) * limit;

  const targetTable = table as Table;

  const [[totalResult], items] = await Promise.all([
    db.select({ total: count() }).from(targetTable).where(whereClause),
    db
      .select()
      .from(targetTable)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)
      .$dynamic(),
  ]);

  const total = Number(totalResult?.total ?? 0);

  return buildPaginatedResponse(items as TTable["$inferSelect"][], total, page, limit);
}
