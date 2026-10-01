import { compact, uniq } from "es-toolkit";
import { normalize } from "pathe";

export const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isEmpty = (value: unknown): boolean =>
  typeof value !== "string" || value.trim().length === 0;

function uniqueNormalizedPaths(paths: Iterable<string>, limit?: number): string[] {
  const list = compact(Array.from(paths).map((p) => normalize(normalize(p))));
  const result = uniq(list);

  return limit != null ? result.slice(0, limit) : result;
}

export function uniqueObjectPaths<T extends { path: string }>(
  items: Iterable<T>,
  limit?: number,
): string[] {
  return uniqueNormalizedPaths(
    Array.from(items).map((i) => i.path),
    limit,
  );
}
