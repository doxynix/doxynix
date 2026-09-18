import { describe, expect, it } from "vitest";

import type { ModuleRef, RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import type { RepositoryModuleFile } from "./context-manager";
import { buildMapperSkeleton } from "./mapper-skeleton";

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    analysisCoverage: {
      heuristicFiles: 10,
      parserCoveragePercent: 50,
      totalFiles: 20,
      treeSitterFiles: 8,
      typeScriptAstFiles: 6,
    },
    churnHotspots: [],
    dependencyHotspots: [{ exports: 1, inbound: 1, outbound: 1, path: "dep.ts" }],
    languages: [{ lines: 500, name: "TypeScript" }],
    techStack: ["TypeScript", "React"],
    tsStaticHints: [],
    ...overrides,
  }) as unknown as RepoMetrics;

const makeEvidence = (overrides: Partial<RepositoryEvidence> = {}): RepositoryEvidence =>
  ({
    configs: [],
    dependencyGraph: {
      edges: [],
      resolvedEdges: 7,
      unresolvedImportSpecifiers: 1,
      unresolvedSamples: [{ fromPath: "src/x.ts", specifier: "pkg" }],
    },
    entrypoints: [],
    fileCategoryBreakdown: [{ category: "runtime-source", count: 5 }],
    frameworkFacts: [{ category: "framework", confidence: 0.9, name: "React" }],
    modules: [],
    routeInventory: {
      estimatedOperations: 3,
      frameworks: ["express"],
      sourceFiles: [],
    },
    routes: [],
    ...overrides,
  }) as unknown as RepositoryEvidence;

const file = (path: string, lines: number): RepositoryModuleFile => ({
  content: Array.from({ length: lines }, (_, index) => `line-${index}`).join("\n"),
  path,
});

const parse = (skeleton: string) => JSON.parse(skeleton) as Record<string, unknown>;

describe("buildMapperSkeleton", () => {
  it("selects files with loc > 5 and sorts by score", () => {
    const skeleton = buildMapperSkeleton(
      [file("src/small.ts", 3), file("src/main.ts", 8), file("src/other.ts", 8)],
      makeMetrics(),
      makeEvidence({
        entrypoints: [{ confidence: 0.9, kind: "runtime", path: "src/main.ts", reason: "main" }],
      }),
    );

    const payload = parse(skeleton);
    const files = payload.files as Array<{ p: string; role: string }>;

    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({ loc: 8, p: "src/main.ts", role: "source" });
    expect(files[1]).toEqual({ loc: 8, p: "src/other.ts", role: "source" });
  });

  it("assigns config/api roles and marks server/ui by path", () => {
    const skeleton = buildMapperSkeleton(
      [
        file("tsconfig.json", 20),
        file("api/routes.ts", 20),
        file("server/index.ts", 20),
        file("lib/server/index.ts", 20),
        file("src/client/button.tsx", 20),
        file("plain/util.ts", 20),
      ],
      makeMetrics(),
      makeEvidence({
        configs: [{ confidence: 0.9, kind: "json", path: "tsconfig.json" }],
        routes: [{ confidence: 0.9, kind: "http", path: "/users", sourcePath: "api/routes.ts" }],
      }),
    );

    const files = parse(skeleton).files as Array<{ p: string; role: string }>;
    const byPath = new Map(files.map((entry) => [entry.p, entry.role]));

    expect(byPath.get("tsconfig.json")).toBe("config");
    expect(byPath.get("api/routes.ts")).toBe("api");
    expect(byPath.get("server/index.ts")).toBe("source");
    expect(byPath.get("lib/server/index.ts")).toBe("server");
    expect(byPath.get("src/client/button.tsx")).toBe("ui");
    expect(byPath.get("plain/util.ts")).toBe("source");
  });

  it("when all files are small, files is empty but the skeleton is kept", () => {
    const skeleton = buildMapperSkeleton([file("a.ts", 3)], makeMetrics(), makeEvidence());

    const payload = parse(skeleton);

    expect(payload.files).toEqual([]);
    expect(payload.analysisCoverage).toEqual({
      heuristicFiles: 10,
      parserCoveragePercent: 50,
      totalFiles: 20,
      treeSitterFiles: 8,
      typeScriptAstFiles: 6,
    });
    expect(payload.graphReliability).toEqual({
      resolvedEdges: 7,
      unresolvedImportSpecifiers: 1,
      unresolvedSamples: [{ fromPath: "src/x.ts", specifier: "pkg" }],
    });
    expect(payload.openapiInventory).toEqual({
      estimatedOperations: 0,
      pathPatterns: [],
      sourceFiles: [],
    });
    expect(payload.languages).toEqual([{ lines: 500, name: "TypeScript" }]);
    expect(payload.techStack).toEqual(["TypeScript", "React"]);
    expect(Array.isArray(payload.reportFocus)).toBe(true);
  });

  it("filters and sorts modules by architectural relevance", () => {
    const modules = [
      {
        apiSurface: 1,
        categories: ["config"],
        entrypointHints: [],
        exports: 1,
        frameworkHints: [],
        imports: [],
        parseTier: "heuristic" as const,
        path: "src/weak",
        routeCount: 0,
        symbols: [],
      },
      {
        apiSurface: 9,
        categories: ["runtime-source"],
        entrypointHints: [],
        exports: 5,
        frameworkHints: [],
        imports: [],
        parseTier: "heuristic" as const,
        path: "src/strong",
        routeCount: 4,
        symbols: [],
      },
    ] as unknown as ModuleRef[];

    const skeleton = buildMapperSkeleton(
      [file("src/strong/a.ts", 10), file("src/weak/b.ts", 10)],
      makeMetrics(),
      makeEvidence({ modules }),
    );

    const payload = parse(skeleton);
    const compactedModules = payload.modules as Array<{ path: string; apiSurface: number }>;

    expect(compactedModules.map((module) => module.path)).toEqual(["src/strong"]);
    expect(compactedModules[0]).toEqual(
      expect.objectContaining({ apiSurface: 9, exports: 5, routeCount: 4 }),
    );
  });

  it("accounts for openapiInventory from metrics as an api source", () => {
    const skeleton = buildMapperSkeleton(
      [file("openapi.yaml", 30)],
      makeMetrics({
        openapiInventory: {
          estimatedOperations: 1,
          pathPatterns: [],
          sourceFiles: ["openapi.yaml"],
        },
      }),
      makeEvidence(),
    );

    const files = parse(skeleton).files as Array<{ p: string; role: string }>;

    expect(files[0]?.role).toBe("api");
  });
});
