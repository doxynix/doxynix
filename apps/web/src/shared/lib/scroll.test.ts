import { describe, expect, it } from "vitest";

import { calculateScrollStep, easeInOutCubic } from "./scroll";

describe("easeInOutCubic", () => {
  it("should return 0 at the start of progress", () => {
    expect(easeInOutCubic(0)).toBe(0);
  });

  it("should return 0.5 at exact midpoint", () => {
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it("should return 1 at the end of progress", () => {
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe("calculateScrollStep", () => {
  it("should compute correct intermediate position at half duration", () => {
    const result = calculateScrollStep(1000, 1400, 800, 100, 400);
    expect(result.position).toBe(300);
    expect(result.isFinished).toBe(false);
  });

  it("should mark operation as finished when duration bound is met", () => {
    const result = calculateScrollStep(1000, 1800, 800, 100, 400);
    expect(result.position).toBe(500);
    expect(result.isFinished).toBe(true);
  });

  it("should clip position to distance max cap when duration overflows", () => {
    const result = calculateScrollStep(1000, 2500, 800, 100, 400);
    expect(result.position).toBe(500);
    expect(result.isFinished).toBe(true);
  });
});
