import { describe, expect, it } from "vitest";

import type { FileSignals } from "./discovery.types";
import { collectStructuralSignals, scoreStructuralModularity } from "./structure";

const makeSignals = (path: string, overrides: Partial<FileSignals> = {}): FileSignals => ({
  analysisMode: "typescript-ast",
  apiSurface: 2,
  complexityMetrics: { complexity: 5, maxNesting: 2 },
  confidence: 90,
  entrypointHint: true,
  entrypointRefs: [{ confidence: 90, kind: "runtime", path, reason: "main" }],
  exports: 3,
  frameworkHints: [],
  imports: ["./util"],
  path,
  routes: [],
  source: "extraction",
  symbols: [],
  ...overrides,
});

describe("structure.ts", () => {
  describe("collectStructuralSignals", () => {
    it("assembles structural signals and graph preview edges from analyzed files", async () => {
      const files = [
        { content: "import './util';", path: "src/app.ts" },
        { content: "export const x = 1;", path: "src/util.ts" },
        { content: "{}", path: "tsconfig.json" },
      ];

      const fileSignalsByPath = new Map<string, FileSignals>([
        ["src/app.ts", makeSignals("src/app.ts", { imports: ["./util"] })],
        ["src/util.ts", makeSignals("src/util.ts", { entrypointHint: false, entrypointRefs: [] })],
        ["tsconfig.json", makeSignals("tsconfig.json", { analysisMode: "heuristic", imports: [] })],
      ]);

      const complexities = [
        { path: "src/app.ts", score: 10 },
        { path: "src/util.ts", score: 2 },
      ];

      const { evidence, structuralSignals } = await collectStructuralSignals(
        files,
        complexities,
        fileSignalsByPath,
      );

      expect(evidence).toBeDefined();
      expect(structuralSignals.entrypoints).toContain("src/app.ts");
      expect(structuralSignals.configInventory).toContain("tsconfig.json");
      expect(structuralSignals.graphPreviewEdges).toContainEqual({
        fromPath: "src/app.ts",
        toPath: "src/util.ts",
        weight: 1,
      });
    });
  });

  describe("scoreStructuralModularity", () => {
    it("returns a near-perfect score for an acyclic, low-hotspot structure", () => {
      const score = scoreStructuralModularity({
        dependencyCycles: [],
        dependencyHotspots: [
          { exports: 1, inbound: 1, outbound: 1, path: "a.ts" },
          { exports: 1, inbound: 2, outbound: 1, path: "b.ts" },
        ],
        orphanModules: [],
      });

      expect(score).toBeGreaterThan(90);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("penalizes cycles, orphans, and heavy hotspot concentration", () => {
      const score = scoreStructuralModularity({
        dependencyCycles: [
          ["a", "b", "a"],
          ["c", "d", "c"],
        ],
        dependencyHotspots: [
          { exports: 10, inbound: 20, outbound: 5, path: "hot.ts" },
          { exports: 8, inbound: 18, outbound: 3, path: "core.ts" },
        ],
        orphanModules: ["src/legacy/unused.ts", "src/old/unused.ts"],
      });

      expect(score).toBeLessThan(80);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
