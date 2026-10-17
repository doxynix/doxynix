export type IntBounds = {
  max: number;
  min?: number;
};

export class OptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptionValidationError";
  }
}

export function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  bounds: IntBounds,
  flag: string,
): number {
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  const min = bounds.min ?? 1;

  if (!Number.isFinite(parsed) || parsed < min) {
    throw new OptionValidationError(
      `Invalid ${flag} value: '${raw}'. Expected a number >= ${min}; fractions are rounded down.`,
    );
  }

  return Math.max(min, Math.min(bounds.max, Math.floor(parsed)));
}
