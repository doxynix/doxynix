import { describe, expect, it } from "vitest";

import { formatSize } from "./size-format";

describe("formatSize", () => {
  it("returns 0 B for undefined, null, non-finite or negative", () => {
    expect(formatSize()).toBe("0 B");
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(-5)).toBe("0 B");
    expect(formatSize(Number.POSITIVE_INFINITY)).toBe("0 B");
  });

  it("formats bytes into KB, MB and GB with one decimal or integer formatting", () => {
    expect(formatSize(500)).toMatch(/^500(?:\.0)? B$/);
    expect(formatSize(1024)).toMatch(/^1(?:\.0)? KB$/);
    expect(formatSize(1_500_000)).toMatch(/MB|KB/);
    expect(formatSize(5_368_709_120)).toMatch(/GB/);
  });

  it("formats exact thresholds correctly", () => {
    expect(formatSize(1024 ** 2)).toMatch(/^1(?:\.0)? MB$/);
    expect(formatSize(1024 ** 3)).toMatch(/^1(?:\.0)? GB$/);
  });
});
