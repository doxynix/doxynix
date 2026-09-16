import { describe, expect, it } from "vitest";

import { buildRiskSectionBody } from "./risk-model";

describe("buildRiskSectionBody", () => {
  it("aggregates risk signals into a non-empty findings list", () => {
    const evidence = {
      configs: [],
      dependencyCycles: [["a", "b", "a"]],
      dependencyGraph: {
        edges: [],
        resolvedEdges: 6,
        unresolvedImportSpecifiers: 1,
        unresolvedSamples: [{ fromPath: "src/a.ts", specifier: "@/missing" }],
      },
      entrypoints: [],
      fileCategoryBreakdown: [],
      frameworkFacts: [],
      hotspotSignals: [
        {
          categories: ["runtime-source"],
          churnScore: 4,
          complexity: 70,
          confidence: 88,
          inbound: 5,
          outbound: 1,
          path: "src/core/engine.ts",
          score: 90,
          source: "risk-model",
        },
      ],
      modules: [],
      orphanModules: ["src/legacy/unused.ts"],
      publicSurface: [],
      routeInventory: {
        estimatedOperations: 0,
        frameworks: [],
        httpRoutes: [],
        rpcProcedures: 0,
        source: "extracted",
        sourceFiles: [],
      },
      routes: [],
      symbols: [],
    } as any;

    const body = buildRiskSectionBody(evidence, {
      changeCoupling: [{ commits: 12, fromPath: "src/a.ts", toPath: "src/b.ts" }],
      complexityScore: 60,
      graphReliability: {
        edges: [],
        resolvedEdges: 6,
        unresolvedImportSpecifiers: 1,
        unresolvedSamples: [{ fromPath: "src/a.ts", specifier: "@/missing" }],
      },
      hotspotSignals: evidence.hotspotSignals,
    } as any);

    expect(body.derivedScores.overallRisk).toBeGreaterThanOrEqual(0);
    expect(body.findings.length).toBeGreaterThan(0);
    expect(body.findings.some((finding) => finding.signal === "hotspot")).toBe(true);
  });
});
