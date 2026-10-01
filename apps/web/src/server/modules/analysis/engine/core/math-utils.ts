import { clamp } from "es-toolkit";

export function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * ratio);

  const safeIndex = clamp(index, 0, sorted.length - 1);

  return sorted[safeIndex] ?? 0;
}
