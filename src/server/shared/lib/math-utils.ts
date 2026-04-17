/**
 * Calculate percentile value from an array of numbers.
 *
 * @param values - Array of numbers
 * @param ratio - Percentile ratio (0-1, e.g. 0.5 for median, 0.95 for p95)
 * @returns The percentile value, or 0 for empty arrays
 */
export function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * ratio);

  const safeIndex = Math.max(0, Math.min(index, sorted.length - 1));

  return sorted[safeIndex] ?? 0;
}
