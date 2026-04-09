export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeRepoPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}

/**
 * Extract file extension from path.
 * Handles normalized paths and returns lowercase extension with dot.
 *
 * @example
 * getFileExtension("src/app.ts") // ".ts"
 * getFileExtension("src/app.tsx") // ".tsx"
 * getFileExtension("readme") // ""
 */
export function getFileExtension(filePath: string): string {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex) : "";
}

export function calculateDocDensity(source: number, comment: number) {
  if (source === 0) return 0;
  return Math.round((comment / (source + comment)) * 100);
}

export function buildEvidence(paths: string[], note?: string) {
  return paths.map((filePath) => ({
    note,
    path: normalizeRepoPath(filePath),
  }));
}
