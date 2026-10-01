import { compact, uniq } from "es-toolkit";
import { basename, extname, normalize } from "pathe";

export function getFileExtension(filePath: string): string {
  return extname(normalize(filePath));
}

export function getFileName(filePath: string): string {
  return basename(normalize(filePath));
}

function uniqueNormalizedPaths(paths: Iterable<string>, limit?: number): string[] {
  const list = uniq(compact(Array.from(paths).map((path) => normalize(path))));

  return limit != null ? list.slice(0, limit) : list;
}

export function uniqueObjectPaths<T extends { path: string }>(
  items: Iterable<T>,
  limit?: number,
): string[] {
  const paths = Array.from(items).map((i) => i.path);
  return uniqueNormalizedPaths(paths, limit);
}

export function uniqueStringPaths(
  paths: Iterable<false | null | string | undefined>,
  limit?: number,
): string[] {
  const cleanPaths = compact(Array.from(paths));
  return uniqueNormalizedPaths(cleanPaths, limit);
}

export function excludePath(
  paths: Iterable<string>,
  excludedPath: string,
  limit?: number,
): string[] {
  const normalizedExcluded = normalize(excludedPath);

  const filtered = Array.from(paths).filter((p) => normalize(p) !== normalizedExcluded);

  return uniqueNormalizedPaths(filtered, limit);
}
