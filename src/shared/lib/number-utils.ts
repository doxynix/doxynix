export function clampIntegerParam(
  value: null | number | undefined,
  {
    fallback,
    max,
    min,
  }: {
    fallback: number;
    max: number;
    min: number;
  }
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
