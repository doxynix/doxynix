import { describe, expect, it } from "vitest";

import {
  mergeRouteInventories,
  normalizeComplexityScore,
  normalizeTechDebtScore,
} from "./code-metric-formulas";

describe("code-metric-formulas", () => {
  describe("normalizeComplexityScore", () => {
    it("should return 100 if scores is empty or fileCount is 0", () => {
      expect(normalizeComplexityScore({ cycles: 0, fileCount: 0, maxNesting: 0, scores: [] })).toBe(
        100,
      );
      expect(normalizeComplexityScore({ cycles: 0, fileCount: 1, maxNesting: 0, scores: [] })).toBe(
        100,
      );
    });

    it("should calculate based on various penalties", () => {
      const score = normalizeComplexityScore({
        cycles: 1,
        fileCount: 10,
        maxNesting: 5,
        scores: [10, 20, 30, 40, 50],
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      // Ensure we hit the score paths (not 0 or 100)
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it("should handle threshold cases", () => {
      // High complexity scores
      const score = normalizeComplexityScore({
        cycles: 0,
        fileCount: 5,
        maxNesting: 0,
        scores: [90, 90, 90, 90, 90], // All high complexity
      });
      expect(score).toBeLessThan(100);
    });
  });

  describe("normalizeTechDebtScore", () => {
    it("should return 100 if fileCount is 0", () => {
      expect(
        normalizeTechDebtScore({
          dependencyCycles: 0,
          duplicationPercentage: 0,
          fileCount: 0,
          orphanModules: 0,
          todos: 0,
        }),
      ).toBe(100);
    });

    it("should calculate penalties for todo, duplication, cycles, orphans", () => {
      const score = normalizeTechDebtScore({
        dependencyCycles: 1,
        duplicationPercentage: 20,
        fileCount: 10,
        orphanModules: 2,
        todos: 10,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(100);
    });

    it("should handle edge cases", () => {
      // High penalties that should result in the minimum possible score (based on penalty caps)
      const score = normalizeTechDebtScore({
        dependencyCycles: 100,
        duplicationPercentage: 100,
        fileCount: 1,
        orphanModules: 10,
        todos: 100,
      });
      // 100 - 18 - 28 - 22 - 18 = 14
      expect(score).toBe(14);
    });
  });

  describe("mergeRouteInventories", () => {
    it("should merge inventories correctly (mixed)", () => {
      const extracted = {
        estimatedOperations: 5,
        frameworks: ["Express"],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "extracted",
        sourceFiles: ["a.ts"],
      } as any;

      const openapi = {
        estimatedOperations: 10,
        frameworks: ["OpenAPI"],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "openapi",
        sourceFiles: ["b.ts"],
      } as any;

      const merged = mergeRouteInventories(extracted, openapi);

      expect(merged.estimatedOperations).toBe(10);
      expect(merged.frameworks).toEqual(["Express", "OpenAPI"]);
      expect(merged.source).toBe("mixed");
      expect(merged.sourceFiles).toEqual(["a.ts", "b.ts"]);
    });

    it("should handle extracted source only", () => {
      const extracted = {
        estimatedOperations: 5,
        frameworks: ["Express"],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "extracted",
        sourceFiles: ["a.ts"],
      } as any;

      const merged = mergeRouteInventories(extracted, {
        estimatedOperations: 0,
        frameworks: [],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "openapi",
        sourceFiles: [],
      } as any);
      expect(merged.source).toBe("extracted");
      expect(merged.estimatedOperations).toBe(5);
    });

    it("should handle empty extracted inventory", () => {
      const merged = mergeRouteInventories(undefined, {
        estimatedOperations: 10,
        frameworks: ["OpenAPI"],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "openapi",
        sourceFiles: ["b.ts"],
      } as any);
      expect(merged.source).toBe("openapi");
      expect(merged.estimatedOperations).toBe(10);
    });
  });
});
