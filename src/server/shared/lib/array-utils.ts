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
  return Array.from(new Set(values));
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
  paths: Array<false | null | string | undefined>,
  limit?: number
): string[] {
  const deduped = Array.from(
    new Set(paths.filter((path): path is string => typeof path === "string" && path.length > 0))
  );
  return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
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
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of values) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Recursively flatten array of arrays.
 * Useful for flattening evidence paths, finding evidence, etc.
 *
 * @example
 * flatten([[1, 2], [3, [4, 5]]]) // [1, 2, 3, 4, 5]
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((acc, val) => {
    if (Array.isArray(val)) {
      acc.push(...flatten(val));
    } else {
      acc.push(val);
    }
    return acc;
  }, []);
}
