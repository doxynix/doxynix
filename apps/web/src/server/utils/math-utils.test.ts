import { describe, expect, it } from "vitest";

import { percentile } from "./math-utils";

describe("math-utils", () => {
  describe("percentile", () => {
    it("should explicitly return 0 for an empty array", () => {
      const result = percentile([], 0.5);
      expect(result).toBe(0);
    });

    it("should calculate the correct percentile", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // 0.5 ratio should be median (5.5) or nearest integer
      expect(percentile(values, 0.5)).toBe(5);
      // 0.9 ratio
      expect(percentile(values, 0.9)).toBe(9);
    });

    it("should clamp index within bounds", () => {
      const values = [10, 20];
      expect(percentile(values, 2)).toBe(20);
      expect(percentile(values, -1)).toBe(10);
    });

    it("should correctly sort unsorted input array", () => {
      const unsorted = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
      expect(percentile(unsorted, 0.5)).toBe(5);
    });

    it("should handle single element array and boundary ratios", () => {
      expect(percentile([42], 0)).toBe(42);
      expect(percentile([42], 0.5)).toBe(42);
      expect(percentile([42], 1)).toBe(42);
    });

    it("should handle values.length > 0 but not zero check", () => {
      // This should kill the surviving conditional mutation
      expect(percentile([1], 0.5)).toBe(1);
    });
  });
});
