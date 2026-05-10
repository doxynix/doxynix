import { normalize } from "pathe";

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
    path: normalize(filePath),
  }));
}
