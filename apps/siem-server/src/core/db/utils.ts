import { and, type Column, eq, ilike, or, type SQL } from "drizzle-orm";
import { compact } from "es-toolkit";

export function escapeLikePattern(term: string): string {
  return term.trim().replaceAll(/[%_\\]/g, String.raw`\$&`);
}

export function eqIf(column: Column, value: unknown): SQL | undefined {
  return value != null ? eq(column, value) : undefined;
}

export function ilikeIf(column: Column | SQL, value: string | null | undefined): SQL | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }
  return ilike(column, `%${escapeLikePattern(value)}%`);
}

export function searchIf(
  columns: (Column | SQL)[],
  value: string | null | undefined,
): SQL | undefined {
  if (value == null || value.trim() === "") {
    return undefined;
  }
  const pattern = `%${escapeLikePattern(value)}%`;
  const conditions = columns.map((col) => ilike(col, pattern));
  return conditions.length === 1 ? conditions[0] : or(...conditions);
}

export function combineConditions(...conditions: (SQL | undefined)[]): SQL | undefined {
  const activeConditions = compact(conditions);
  return activeConditions.length > 0 ? and(...activeConditions) : undefined;
}
