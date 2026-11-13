import { describe, expect, it } from "vitest";

import type { RepositoryEvidence } from "../core/discovery.types";
import { VALID_REPO_METRICS } from "../core/metrics.fixtures";
import type { RepoMetrics } from "../core/metrics.types";
import { buildDocumentationInputModel } from "./documentation-input";

function makeEvidence(): RepositoryEvidence {
  return {
    calls: [
      {
        calleeName: "boot",
        callerName: "handleRequest",
        line: 3,
        path: "src/server/router.ts",
        resolved: true,
        targetPath: "src/app.ts",
      },
      {
        calleeName: "boot",
        callerName: "helper",
        line: 2,
        path: "src/app.test.ts",
        resolved: true,
        targetPath: "src/app.ts",
      },
    ],
    configs: [],
    dependencyCycles: [],
    dependencyGraph: {
      edges: [],
      resolvedEdges: 1,
      unresolvedImportSpecifiers: 0,
      unresolvedSamples: [],
    },
    entrypoints: [{ confidence: 95, kind: "runtime", path: "src/app.ts", reason: "main" }],
    fileCategoryBreakdown: [{ category: "runtime-source", count: 2 }],
    frameworkFacts: [],
    hotspotSignals: [],
    modules: [
      {
        apiSurface: 4,
        categories: ["runtime-source"],
        entrypointHints: [],
        exports: 1,
        frameworkHints: [],
        imports: [],
        parseTier: "typescript-ast",
        path: "src/app.ts",
        routeCount: 0,
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
      estimatedOperations: 0,
      frameworks: [],
      httpRoutes: [],
      rpcProcedures: 0,
      source: "extracted",
      sourceFiles: [],
    },
    routes: [],
    symbols: [],
  };
}

describe("buildDocumentationInputModel", () => {
  it("includes resolved upstream callers in architecture module summaries", () => {
    const model = buildDocumentationInputModel(
      makeEvidence(),
      VALID_REPO_METRICS as unknown as RepoMetrics,
    );

    expect(model.sections.architecture.body.modules[0]?.upstreamCallers).toEqual([
      "src/server/router.ts:handleRequest",
    ]);
  });
});
