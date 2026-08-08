import { compact, uniq } from "es-toolkit";

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
