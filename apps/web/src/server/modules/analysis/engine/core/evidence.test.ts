import { describe, expect, it } from "vitest";

import type { FileSignals } from "./discovery.types";
import { collectRepositoryEvidence } from "./evidence";

function makeSignals(path: string, overrides: Partial<FileSignals> = {}): FileSignals {
  return {
    analysisMode: "heuristic",
    apiSurface: 0,
    complexityMetrics: { complexity: 0, maxNesting: 0 },
    confidence: 60,
    entrypointHint: false,
    exports: 0,
    imports: [],
    path,
    source: "extraction",
    ...overrides,
  };
}

describe("collectRepositoryEvidence", () => {
  it("assembles full repository evidence from pre-collected file signals", async () => {
    const files = [
      { content: "", path: "src/app.ts" },
      { content: "", path: "src/server/routes/users.ts" },
      { content: "", path: "src/shared/util.ts" },
      { content: "", path: "src/legacy/old.ts" },
      { content: "", path: "tsconfig.json" },
    ];
    const fileSignalsByPath = new Map<string, FileSignals>([
      [
        "src/app.ts",
        makeSignals("src/app.ts", {
          apiSurface: 3,
          complexityMetrics: { complexity: 5, maxNesting: 2 },
          entrypointHint: true,
          entrypointRefs: [
            { confidence: 95, kind: "runtime", path: "src/app.ts", reason: "seeded" },
          ],
          exports: 1,
          frameworkHints: [
            { category: "framework", confidence: 95, name: "hono", sources: ["src/app.ts"] },
          ],
          imports: ["./shared/util", "@/ghost"],
          symbols: [
            { confidence: 75, exported: true, kind: "function", name: "boot", path: "src/app.ts" },
          ],
        }),
      ],
      [
        "src/server/routes/users.ts",
        makeSignals("src/server/routes/users.ts", {
          apiSurface: 6,
          exports: 3,
          imports: ["./shared/util"],
          routes: [
            {
              confidence: 80,
              kind: "http",
              method: "GET",
              path: "/users",
              sourcePath: "src/server/routes/users.ts",
            },
          ],
        }),
      ],
      [
        "src/shared/util.ts",
        makeSignals("src/shared/util.ts", {
          exports: 2,
          symbols: [
            {
              confidence: 70,
              exported: true,
              kind: "function",
              name: "helper",
              path: "src/shared/util.ts",
            },
          ],
        }),
      ],
      [
        "src/legacy/old.ts",
        makeSignals("src/legacy/old.ts", {
          symbols: [
            {
              confidence: 40,
              exported: false,
              kind: "const",
              name: "internal",
              path: "src/legacy/old.ts",
            },
          ],
        }),
      ],
      ["tsconfig.json", makeSignals("tsconfig.json")],
    ]);

    const { dependencyHotspots, evidence } = await collectRepositoryEvidence(
      files,
      [{ path: "src/app.ts", score: 10 }],
      fileSignalsByPath,
    );

    expect(evidence.modules).toHaveLength(5);
    const appModule = evidence.modules.find((module) => module.path === "src/app.ts");
    expect(appModule).toMatchObject({
      apiSurface: 3,
      exports: 1,
      parseTier: "heuristic",
      path: "src/app.ts",
    });

    expect(evidence.entrypoints).toEqual([
      { confidence: 95, kind: "runtime", path: "src/app.ts", reason: "seeded" },
      {
        confidence: 86,
        kind: "runtime",
        path: "src/server/routes/users.ts",
        reason: "top-level API surface with no inbound dependencies",
      },
    ]);

    expect(evidence.dependencyGraph).toMatchObject({
      resolvedEdges: 2,
      unresolvedImportSpecifiers: 1,
      unresolvedSamples: [{ fromPath: "src/app.ts", specifier: "@/ghost" }],
    });
    expect(evidence.dependencyCycles).toEqual([]);
    expect(evidence.orphanModules).toEqual(["src/legacy/old.ts"]);

    expect(evidence.configs).toEqual([
      { confidence: 90, kind: "tsconfig.json", path: "tsconfig.json" },
    ]);

    expect(evidence.frameworkFacts).toEqual([
      { category: "framework", confidence: 95, name: "hono", sources: ["src/app.ts"] },
    ]);

    expect(evidence.routeInventory).toMatchObject({
      estimatedOperations: 1,
      frameworks: ["hono"],
      httpRoutes: [{ method: "GET", path: "/users", sourcePath: "src/server/routes/users.ts" }],
      rpcProcedures: 0,
      source: "extracted",
    });

    expect(evidence.fileCategoryBreakdown).toEqual([
      { category: "runtime-source", count: 4 },
      { category: "config", count: 1 },
    ]);

    expect(dependencyHotspots[0]?.path).toBe("src/shared/util.ts");
    expect(evidence.hotspotSignals[0]?.path).toBe("src/server/routes/users.ts");
    expect(evidence.hotspotSignals).toHaveLength(4);

    expect(evidence.publicSurface.map((symbol) => symbol.name).sort()).toEqual(["boot", "helper"]);
  });
});
