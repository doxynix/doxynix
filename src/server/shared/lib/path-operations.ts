import { normalizeRepoPath } from "../engine/core/common";

export function uniqueNormalizedPaths(paths: Iterable<string>, limit?: number): string[] {
  const values = Array.from(new Set(Array.from(paths, (path) => normalizeRepoPath(path))));
  return typeof limit === "number" ? values.slice(0, limit) : values;
}

export function uniqueObjectPaths<T extends { path: string }>(items: Iterable<T>, limit?: number) {
  return uniqueNormalizedPaths(
    Array.from(items, (item) => item.path),
    limit
  );
}

export function uniqueStringPaths(
  paths: Iterable<false | null | string | undefined>,
  limit?: number
): string[] {
  const values = Array.from(
    new Set(
      Array.from(paths).filter(
        (path): path is string => typeof path === "string" && path.length > 0
      )
    )
  );
  return typeof limit === "number" ? values.slice(0, limit) : values;
}

export function excludePath(paths: Iterable<string>, excludedPath: string, limit?: number) {
  const normalizedExcludedPath = normalizeRepoPath(excludedPath);
  const filtered = Array.from(paths).filter(
    (candidatePath) => normalizeRepoPath(candidatePath) !== normalizedExcludedPath
  );
  return uniqueNormalizedPaths(filtered, limit);
}
