import { describe, expect, it } from "vitest";

import { clampIntegerParam } from "@/shared/lib/number-utils";

describe("shared/lib/number:clampIntegerParam", () => {
  it("clamps invalid values to fallback and valid values to bounds", () => {
    expect(clampIntegerParam(undefined, { fallback: 1, max: 100, min: 1 })).toBe(1);
    expect(clampIntegerParam(Number.NaN, { fallback: 1, max: 100, min: 1 })).toBe(1);
    expect(clampIntegerParam(0, { fallback: 1, max: 100, min: 1 })).toBe(1);
    expect(clampIntegerParam(-200_000_000_000_000, { fallback: 1, max: 100, min: 1 })).toBe(1);
    expect(clampIntegerParam(200_000_000_000_000, { fallback: 1, max: 100, min: 1 })).toBe(100);
    expect(clampIntegerParam(25, { fallback: 1, max: 100, min: 1 })).toBe(25);
    expect(clampIntegerParam(1.5, { fallback: 1, max: 100, min: 1 })).toBe(1);
  });
});
