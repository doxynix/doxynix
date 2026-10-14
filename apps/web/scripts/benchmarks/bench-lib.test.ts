import { describe, expect, it } from "vitest";

import { benchStats } from "./bench-lib";

describe("benchStats", () => {
  it("reports the median, not the mean, so one cold outlier cannot invert a result", () => {
    // 9 fast samples and 1 slow one. Mean = 41.9, median = 1. A benchmark that
    // reported the mean would call a fast query slow.
    const s = benchStats([1, 1, 1, 1, 1, 1, 1, 1, 1, 300]);
    expect(s.median).toBe(1);
    expect(s.max).toBe(300);
  });

  it("computes p95 and p99 from the sorted sample", () => {
    const s = benchStats(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(s.median).toBe(50);
    expect(s.p95).toBeGreaterThanOrEqual(s.median);
    expect(s.p99).toBeGreaterThanOrEqual(s.p95);
  });

  it("returns zeroes rather than NaN for an empty sample", () => {
    expect(benchStats([])).toMatchObject({ median: 0, n: 0 });
  });
});
