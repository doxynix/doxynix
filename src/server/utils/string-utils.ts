import { compact, uniq } from "es-toolkit";
import { normalize } from "pathe";
import validator from "validator";

/**
 * Type-safe guard for non-empty strings.
 */
export const hasText = (value: unknown): value is string =>
  typeof value === "string" && !validator.isEmpty(value, { ignore_whitespace: true });

/**
 * Check if empty/whitespace.
 */
export const isEmpty = (value: unknown): boolean =>
  typeof value !== "string" || validator.isEmpty(value, { ignore_whitespace: true });

function uniqueNormalizedPaths(paths: Iterable<string>, limit?: number): string[] {
  const list = compact(Array.from(paths).map((p) => normalize(normalize(p))));
  const result = uniq(list);

  return limit != null ? result.slice(0, limit) : result;
}

export function uniqueObjectPaths<T extends { path: string }>(
  items: Iterable<T>,
  limit?: number
): string[] {
  return uniqueNormalizedPaths(
    Array.from(items).map((i) => i.path),
    limit
  );
}
