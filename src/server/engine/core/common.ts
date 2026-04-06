export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeRepoPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
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
