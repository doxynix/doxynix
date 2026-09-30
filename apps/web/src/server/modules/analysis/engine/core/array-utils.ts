import { compact, uniq } from "es-toolkit";

export function uniquePaths(
  paths: Iterable<false | null | string | undefined>,
  limit?: number,
): string[] {
  const items = Array.from(paths);

  const cleaned = compact(items);

  const result = uniq(cleaned);

  return typeof limit === "number" ? result.slice(0, limit) : result;
}
