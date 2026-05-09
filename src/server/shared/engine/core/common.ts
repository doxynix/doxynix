import { clamp as esToolkitClamp } from "es-toolkit";
import { normalize } from "pathe";

export function clamp(value: number, min: number, max: number): number {
  return esToolkitClamp(value, min, max);
}

export function normalizeRepoPath(filePath: string): string {
  return normalize(filePath);
}

export function calculateDocDensity(source: number, comment: number): number {
  const totalLines = source + comment;
  if (totalLines === 0) return 0;

  return Math.round((comment / totalLines) * 100);
}

export function buildEvidence(
  paths: string[],
  note?: string
): Array<{ note?: string; path: string }> {
  return paths.map((filePath) => ({
    note,
    path: normalizeRepoPath(filePath),
  }));
}
