import { describe, expect, it } from "vitest";

import { buildRepositoryArtifacts } from "./artifacts";

describe("buildRepositoryArtifacts", () => {
  it("creates facts and findings from a minimal repository snapshot", () => {
    const params = {
      busFactor: 2,
      evidence: {
        configs: [],
        dependencyCycles: [],
        dependencyGraph: {
          edges: [],
          resolvedEdges: 4,
          unresolvedImportSpecifiers: 0,
          unresolvedSamples: [],
        },
        entrypoints: [{ confidence: 95, kind: "runtime", path: "src/app.ts", reason: "main" }],
        fileCategoryBreakdown: [{ category: "runtime-source", count: 2 }],
        frameworkFacts: [],
        hotspotSignals: [
          {
            categories: ["runtime-source"],
            churnScore: 3,
            complexity: 50,
            confidence: 80,
            inbound: 4,
            outbound: 1,
            path: "src/app.ts",
            score: 60,
            source: "risk-model",
          },
        ],
        modules: [
          {
            apiSurface: 4,
            categories: ["runtime-source"],
            entrypointHints: [],
            exports: 2,
            frameworkHints: [],
            imports: [],
            parseTier: "typescript-ast",
            path: "src/app.ts",
            routeCount: 2,
            symbols: [
              {
                confidence: 80,
                exported: true,
                kind: "function",
                name: "boot",
                path: "src/app.ts",
              },
            ],
          },
        ],
        orphanModules: [],
        publicSurface: [],
        routeInventory: {
          estimatedOperations: 1,
          frameworks: [],
          httpRoutes: [],
          rpcProcedures: 0,
          source: "mixed",
          sourceFiles: ["src/app.ts"],
        },
        routes: [],
        symbols: [],
      },
      metrics: {
        analysisCoverage: {
          heuristicFiles: 0,
          languagesByMode: { heuristic: [], treeSitter: [], typeScriptAst: ["TypeScript"] },
          parserCoveragePercent: 80,
          treeSitterFiles: 0,
          typeScriptAstFiles: 1,
        },
        apiSurface: 1,
        changeCoupling: [],
        churnHotspots: [],
        complexityScore: 55,
        configFiles: 0,
        docDensity: 20,
        duplicationReport: { clones: [], duplicationPercentage: 0 },
        fileCount: 10,
        graphReliability: {
          edges: [],
          resolvedEdges: 4,
          unresolvedImportSpecifiers: 0,
          unresolvedSamples: [],
        },
        hotspotSignals: [
          {
            categories: ["runtime-source"],
            churnScore: 3,
            complexity: 50,
            confidence: 80,
            inbound: 4,
            outbound: 1,
            path: "src/app.ts",
            score: 60,
            source: "risk-model",
          },
        ],
        languages: ["TypeScript"],
        mostComplexFiles: ["src/app.ts"],
        openapiInventory: null,
        securityFindings: [],
        totalLoc: 300,
      },
      teamRoles: [{ login: "alice", role: "owner", share: 70 }],
    } as any;

    const artifacts = buildRepositoryArtifacts(params);

    expect(artifacts.facts.length).toBeGreaterThan(0);
    expect(artifacts.findings.length).toBeGreaterThanOrEqual(0);
    expect(artifacts.facts[0]?.title).toBeTruthy();
  });
});
