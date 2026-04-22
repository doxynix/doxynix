import { compact, flattenDeep, uniq, uniqBy } from "es-toolkit";

/**
 * Array manipulation utilities for the server layer.
 * Shared across all features and entities.
 */

/**
 * Generic deduplication using Set.
 * Preserves first occurrence order.
 *
 * @example
 * unique([1, 2, 2, 3]) // [1, 2, 3]
 * unique(paths.map(normalizePath)) // unique normalized paths
 */
export function unique<T>(values: T[]): T[] {
  return uniq(values);
}

/**
 * Deduplicate paths with optional filtering and limiting.
 * Filters out empty strings and null/undefined values.
 *
 * @param paths - Array of string paths or falsy values
 * @param limit - Optional maximum number of paths to return
 * @returns Unique non-empty paths
 *
 * @example
 * uniquePaths(paths) // Remove duplicates and empty strings
 * uniquePaths(paths, 10) // Get first 10 unique non-empty paths
 */
export function uniquePaths(
  paths: Iterable<false | null | string | undefined>,
  limit?: number
): string[] {
  const items = Array.from(paths);

  const cleaned = compact(items) as string[];

  const result = uniq(cleaned);

  return typeof limit === "number" ? result.slice(0, limit) : result;
}

/**
 * Deduplicate by a custom key function.
 * Useful for objects where you want uniqueness by a specific property.
 *
 * @example
 * uniqueBy(users, (u) => u.id)
 * uniqueBy(paths, (p) => normalizePath(p))
 */
export function uniqueBy<T, K>(values: T[], keyFn: (item: T) => K): T[] {
  return uniqBy(values, keyFn);
}

/**
 * Recursively flatten array of arrays.
 * Useful for flattening evidence paths, finding evidence, etc.
 *
 * @example
 * flatten([[1, 2], [3, [4, 5]]]) // [1, 2, 3, 4, 5]
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return flattenDeep(arr) as T[];
}
