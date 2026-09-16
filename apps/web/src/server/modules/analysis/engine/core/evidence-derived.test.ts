import { describe, expect, it } from "vitest";

import type { EntrypointRef, ModuleRef } from "./discovery.types";
import {
  buildDependencyHotspots,
  buildFileCategoryBreakdown,
  buildHotspotSignals,
  buildMainEntrypointPaths,
  buildOrphanModules,
  dedupeConfigs,
  inferEntrypoints,
} from "./evidence-derived";

function makeModule(path: string, overrides: Partial<ModuleRef> = {}): ModuleRef {
  return {
    apiSurface: 0,
    categories: ["runtime-source"],
    entrypointHints: [],
    exports: 0,
    frameworkHints: [],
    imports: [],
    parseTier: "heuristic",
    path,
    routeCount: 0,
    symbols: [],
    ...overrides,
  };
}

function makeHint(overrides: Partial<EntrypointRef>): EntrypointRef {
  return { confidence: 0, kind: "runtime", path: "", reason: "", ...overrides };
}

describe("inferEntrypoints", () => {
  it("detects a top-level runtime entrypoint with zero inbound dependencies", () => {
    const moduleByPath = new Map([
      ["src/app.ts", makeModule("src/app.ts", { apiSurface: 2, exports: 1 })],
    ]);
    const inboundByFile = new Map([["src/app.ts", 0]]);
    const apiSurfaceByFile = new Map([["src/app.ts", 2]]);
    const exportsByFile = new Map([["src/app.ts", 1]]);

    expect(
      inferEntrypoints({ apiSurfaceByFile, exportsByFile, inboundByFile, moduleByPath }),
    ).toEqual([
      {
        confidence: 86,
        kind: "runtime",
        path: "src/app.ts",
        reason: "top-level API surface with no inbound dependencies",
      },
    ]);
  });

  it("flags export-heavy index files as library entrypoints", () => {
    const moduleByPath = new Map([
      ["src/shared/index.ts", makeModule("src/shared/index.ts", { exports: 5 })],
    ]);
    const inboundByFile = new Map([["src/shared/index.ts", 0]]);

    expect(
      inferEntrypoints({
        apiSurfaceByFile: new Map(),
        exportsByFile: new Map([["src/shared/index.ts", 5]]),
        inboundByFile,
        moduleByPath,
      }),
    ).toEqual([
      {
        confidence: 72,
        kind: "library",
        path: "src/shared/index.ts",
        reason: "export-heavy index file with no inbound references suggests public surface",
      },
    ]);
  });

  it("keeps isolated non-runtime files as secondary entrypoint evidence", () => {
    const moduleByPath = new Map([
      ["scripts/build.ts", makeModule("scripts/build.ts", { categories: ["tooling"] })],
      ["benchmarks/bench.ts", makeModule("benchmarks/bench.ts", { categories: ["benchmark"] })],
      ["src/x.test.ts", makeModule("src/x.test.ts", { categories: ["test"] })],
    ]);
    const inboundByFile = new Map([
      ["scripts/build.ts", 0],
      ["benchmarks/bench.ts", 0],
      ["src/x.test.ts", 0],
    ]);

    expect(
      inferEntrypoints({
        apiSurfaceByFile: new Map(),
        exportsByFile: new Map(),
        inboundByFile,
        moduleByPath,
      }),
    ).toEqual([
      {
        confidence: 58,
        kind: "benchmark",
        path: "benchmarks/bench.ts",
        reason: "isolated non-runtime file kept as secondary entrypoint evidence",
      },
      {
        confidence: 58,
        kind: "tooling",
        path: "scripts/build.ts",
        reason: "isolated non-runtime file kept as secondary entrypoint evidence",
      },
      {
        confidence: 58,
        kind: "test",
        path: "src/x.test.ts",
        reason: "isolated non-runtime file kept as secondary entrypoint evidence",
      },
    ]);
  });

  it("downgrades library or runtime hints outside the primary runtime contour", () => {
    const moduleByPath = new Map([
      [
        "docs/guide.md",
        makeModule("docs/guide.md", {
          categories: ["docs"],
          entrypointHints: [
            makeHint({ confidence: 90, kind: "library", path: "docs/guide.md", reason: "seeded" }),
          ],
        }),
      ],
    ]);

    expect(
      inferEntrypoints({
        apiSurfaceByFile: new Map(),
        exportsByFile: new Map(),
        inboundByFile: new Map([["docs/guide.md", 0]]),
        moduleByPath,
      }),
    ).toEqual([
      {
        confidence: 90,
        kind: "runtime",
        path: "docs/guide.md",
        reason: "seeded; downgraded because the file sits outside the primary runtime contour",
      },
    ]);
  });

  it("deduplicates entrypoints by kind and path, keeping the highest confidence", () => {
    const moduleByPath = new Map([
      [
        "scripts/build.ts",
        makeModule("scripts/build.ts", {
          categories: ["tooling"],
          entrypointHints: [
            makeHint({
              confidence: 60,
              kind: "tooling",
              path: "scripts/build.ts",
              reason: "seeded low",
            }),
            makeHint({
              confidence: 40,
              kind: "tooling",
              path: "scripts/build.ts",
              reason: "seeded lower",
            }),
          ],
        }),
      ],
      [
        "scripts/deploy.ts",
        makeModule("scripts/deploy.ts", {
          categories: ["tooling"],
          entrypointHints: [
            makeHint({
              confidence: 90,
              kind: "tooling",
              path: "scripts/deploy.ts",
              reason: "seeded high",
            }),
          ],
        }),
      ],
    ]);
    const inboundByFile = new Map([
      ["scripts/build.ts", 0],
      ["scripts/deploy.ts", 0],
    ]);

    expect(
      inferEntrypoints({
        apiSurfaceByFile: new Map(),
        exportsByFile: new Map(),
        inboundByFile,
        moduleByPath,
      }),
    ).toEqual([
      { confidence: 90, kind: "tooling", path: "scripts/deploy.ts", reason: "seeded high" },
      { confidence: 60, kind: "tooling", path: "scripts/build.ts", reason: "seeded low" },
    ]);
  });
});

describe("buildMainEntrypointPaths", () => {
  it("keeps only runtime and library entrypoints that pass the primary policy", () => {
    const entrypoints: EntrypointRef[] = [
      { confidence: 86, kind: "runtime", path: "src/app.ts", reason: "runtime" },
      { confidence: 72, kind: "library", path: "src/index.ts", reason: "library" },
      { confidence: 58, kind: "test", path: "src/test.ts", reason: "test" },
    ];

    expect(buildMainEntrypointPaths(entrypoints)).toEqual(new Set(["src/app.ts", "src/index.ts"]));
  });
});

describe("buildOrphanModules", () => {
  it("lists architecture-relevant modules with zero inbound references", () => {
    const modules = [
      makeModule("src/legacy/old.ts"),
      makeModule("docs/guide.md", { categories: ["docs"] }),
      makeModule("src/main.ts"),
      makeModule("src/util.ts"),
    ];
    const inboundByFile = new Map([
      ["src/legacy/old.ts", 0],
      ["docs/guide.md", 0],
      ["src/main.ts", 0],
      ["src/util.ts", 2],
    ]);
    const mainEntrypointPaths = new Set(["src/main.ts"]);

    expect(buildOrphanModules(modules, inboundByFile, mainEntrypointPaths)).toEqual([
      "src/legacy/old.ts",
    ]);
  });
});

describe("buildDependencyHotspots", () => {
  it("ranks modules by inbound, outbound, and exports with architecture weights", () => {
    const modules = [makeModule("src/a.ts"), makeModule("src/b.ts")];
    const exportsByFile = new Map([
      ["src/a.ts", 0],
      ["src/b.ts", 2],
    ]);
    const inboundByFile = new Map([
      ["src/a.ts", 2],
      ["src/b.ts", 0],
    ]);
    const graph = new Map([
      ["src/a.ts", new Set(["src/b.ts"])],
      ["src/b.ts", new Set(["src/a.ts", "src/c.ts", "src/d.ts", "src/e.ts"])],
    ]);

    const result = buildDependencyHotspots(modules, exportsByFile, inboundByFile, graph);

    expect(result).toEqual([
      { exports: 0, inbound: 2, outbound: 1, path: "src/a.ts" },
      { exports: 2, inbound: 0, outbound: 4, path: "src/b.ts" },
    ]);
  });
});

describe("buildHotspotSignals", () => {
  it("computes risk scores with weighted complexity, inbound, outbound, and API surface", () => {
    const modules = [
      makeModule("src/hot.ts", { apiSurface: 3, exports: 2 }),
      makeModule("src/calm.ts", { apiSurface: 0, exports: 0 }),
    ];
    const complexityByFile = new Map([
      ["src/hot.ts", 10],
      ["src/calm.ts", 1],
    ]);
    const inboundByFile = new Map([
      ["src/hot.ts", 1],
      ["src/calm.ts", 0],
    ]);
    const graph = new Map([
      ["src/hot.ts", new Set(["src/calm.ts", "src/other.ts"])],
      ["src/calm.ts", new Set<string>()],
    ]);

    const result = buildHotspotSignals(modules, complexityByFile, inboundByFile, graph);

    expect(result[0]).toEqual({
      categories: ["runtime-source"],
      churnScore: 0,
      complexity: 10,
      confidence: 88,
      inbound: 1,
      outbound: 2,
      path: "src/hot.ts",
      score: 48,
      source: "risk-model",
    });
    expect(result[1]?.path).toBe("src/calm.ts");
  });
});

describe("buildFileCategoryBreakdown", () => {
  it("counts categories and sorts by count descending then category ascending", () => {
    const modules = [
      makeModule("src/a.ts"),
      makeModule("src/b.ts", { categories: ["config", "runtime-source"] }),
      makeModule("src/c.test.ts", { categories: ["test"] }),
    ];

    expect(buildFileCategoryBreakdown(modules)).toEqual([
      { category: "runtime-source", count: 2 },
      { category: "config", count: 1 },
      { category: "test", count: 1 },
    ]);
  });
});

describe("dedupeConfigs", () => {
  it("deduplicates by path and kind, then sorts by path", () => {
    const configs = [
      { confidence: 90, kind: "tsconfig", path: "tsconfig.json" },
      { confidence: 80, kind: "tsconfig", path: "tsconfig.json" },
      { confidence: 90, kind: "other", path: "tsconfig.json" },
    ];

    expect(dedupeConfigs(configs)).toEqual([
      { confidence: 90, kind: "tsconfig", path: "tsconfig.json" },
      { confidence: 90, kind: "other", path: "tsconfig.json" },
    ]);
  });
});
