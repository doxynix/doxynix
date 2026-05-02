import { compact, escape, uniq } from "es-toolkit";
import { basename, extname, normalize } from "pathe";

import { normalizeRepoPath } from "../engine/core/common";

/**
 * Type-safe guard for non-empty strings.
 */
export const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Check if empty/whitespace.
 */
const isEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length === 0;

/**
 * Escape XML text.
 */
export function escapePromptXmlText(value: string): string {
  return escape(value);
}

/**
 * Escape XML attr.
 */
export function escapePromptXmlAttr(value: string): string {
  return escape(value);
}

function getFileExtension(filePath: string): string {
  const normalized = normalize(normalizeRepoPath(filePath));
  return extname(normalized);
}

function getFileName(filePath: string): string {
  const normalized = normalize(normalizeRepoPath(filePath));
  return basename(normalized);
}

function uniqueNormalizedPaths(paths: Iterable<string>, limit?: number): string[] {
  const list = compact(Array.from(paths).map((p) => normalize(normalizeRepoPath(p))));
  const result = uniq(list);

  return limit != null ? result.slice(0, limit) : result;
}

function uniqueObjectPaths<T extends { path: string }>(
  items: Iterable<T>,
  limit?: number
): string[] {
  return uniqueNormalizedPaths(
    Array.from(items).map((i) => i.path),
    limit
  );
}

function uniqueStringPaths(
  paths: Iterable<false | null | string | undefined>,
  limit?: number
): string[] {
  const list = compact(Array.from(paths)).map((p) => normalize(p as string));
  const result = uniq(list);

  return limit != null ? result.slice(0, limit) : result;
}

function excludePath(paths: Iterable<string>, excludedPath: string, limit?: number): string[] {
  const normalizedExcluded = normalize(normalizeRepoPath(excludedPath));

  const filtered = Array.from(paths).filter(
    (p) => normalize(normalizeRepoPath(p)) !== normalizedExcluded
  );

  return uniqueNormalizedPaths(filtered, limit);
}
