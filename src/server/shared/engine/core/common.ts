import { clamp as esToolkitClamp } from "es-toolkit";
import { normalize } from "pathe";

export function clamp(value: number, min: number, max: number): number {
  return esToolkitClamp(value, min, max);
}

export const normalizeRepoPath = (filePath: string) => normalize(filePath);

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
