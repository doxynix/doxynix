import { describe, expect, it } from "vitest";

import type { RouteRef } from "./discovery.types";
import {
  buildEvidenceLookups,
  buildRouteInventory,
  createEvidenceAssembly,
  resolveImportEdges,
} from "./evidence-support";

function makeRoute(overrides: Partial<RouteRef>): RouteRef {
  return { confidence: 80, kind: "http", path: "", sourcePath: "", ...overrides };
}

describe("buildRouteInventory", () => {
  it("counts rpc procedures and http routes with explicit methods", () => {
    const routes: RouteRef[] = [
      makeRoute({ kind: "rpc", path: "/x", sourcePath: "src/api/trpc.ts" }),
      makeRoute({ kind: "http", method: "POST", path: "/items", sourcePath: "src/api/items.ts" }),
      makeRoute({ kind: "http", path: "/weird", sourcePath: "src/api/weird.ts" }),
    ];

    const inventory = buildRouteInventory({
      frameworkFacts: [{ category: "framework", confidence: 72, name: "hono", sources: ["pkg"] }],
      routes,
    });

    expect(inventory).toEqual({
      estimatedOperations: 2,
      frameworks: ["hono"],
      httpRoutes: [{ method: "POST", path: "/items", sourcePath: "src/api/items.ts" }],
      rpcProcedures: 1,
      source: "extracted",
      sourceFiles: ["src/api/items.ts", "src/api/trpc.ts", "src/api/weird.ts"],
    });
  });
});

describe("buildEvidenceLookups", () => {
  it("normalizes paths and builds file set, complexity map, and base name buckets", () => {
    const lookups = buildEvidenceLookups(
      [
        { content: "", path: "src/../src/a.ts" },
        { content: "", path: "src/b.ts" },
        { content: "", path: "lib/C.ts" },
      ],
      [{ path: "src/../src/a.ts", score: 5 }],
    );

    expect(Array.from(lookups.fileSet).sort()).toEqual(["lib/C.ts", "src/a.ts", "src/b.ts"]);
    expect(lookups.complexityByFile.get("src/a.ts")).toBe(5);
    expect(lookups.filesByBaseName.get("a.ts")).toEqual(["src/a.ts"]);
    expect(lookups.filesByBaseName.get("c.ts")).toEqual(["lib/C.ts"]);
  });
});

describe("createEvidenceAssembly", () => {
  it("returns fresh empty assembly structures", () => {
    const assembly = createEvidenceAssembly();

    expect(assembly.apiSurfaceByFile.size).toBe(0);
    expect(assembly.configs).toEqual([]);
    expect(assembly.exportsByFile.size).toBe(0);
    expect(assembly.modules).toEqual([]);
    expect(assembly.routes).toEqual([]);
    expect(assembly.symbols).toEqual([]);
    expect(assembly.dependencyTracking).toEqual({
      edges: [],
      graph: new Map(),
      inboundByFile: new Map(),
      resolvedEdges: 0,
      unresolvedImportSpecifiers: 0,
      unresolvedSamples: [],
    });
  });
});

describe("resolveImportEdges", () => {
  it("resolves relative imports and records inbound edges", () => {
    const files = [
      { content: "", path: "src/app.ts" },
      { content: "", path: "src/util.ts" },
    ];
    const lookups = buildEvidenceLookups(files, []);
    const tracking = createEvidenceAssembly().dependencyTracking;

    const resolved = resolveImportEdges("src/app.ts", ["./util"], lookups, tracking);

    expect(resolved).toEqual(["src/util.ts"]);
    expect(tracking.resolvedEdges).toBe(1);
    expect(tracking.edges).toEqual([
      {
        fromPath: "src/app.ts",
        kind: "internal",
        resolved: true,
        specifier: "./util",
        toPath: "src/util.ts",
      },
    ]);
    expect(tracking.inboundByFile.get("src/util.ts")).toBe(1);
    expect(tracking.graph.get("src/app.ts")).toEqual(new Set(["src/util.ts"]));
  });

  it("skips imports that resolve back to the source file itself", () => {
    const files = [{ content: "", path: "src/app.ts" }];
    const lookups = buildEvidenceLookups(files, []);
    const tracking = createEvidenceAssembly().dependencyTracking;

    const resolved = resolveImportEdges("src/app.ts", ["./app"], lookups, tracking);

    expect(resolved).toEqual([]);
    expect(tracking.edges).toEqual([]);
    expect(tracking.resolvedEdges).toBe(0);
  });

  it("resolves module imports through base name buckets", () => {
    const files = [
      { content: "", path: "src/app.ts" },
      { content: "", path: "src/shared/util.ts" },
    ];
    const lookups = buildEvidenceLookups(files, []);
    const tracking = createEvidenceAssembly().dependencyTracking;

    const resolved = resolveImportEdges("src/app.ts", ["shared/util"], lookups, tracking);

    expect(resolved).toEqual(["src/shared/util.ts"]);
    expect(tracking.edges[0]).toMatchObject({
      kind: "internal",
      resolved: true,
      specifier: "shared/util",
      toPath: "src/shared/util.ts",
    });
  });

  it("classifies unresolved imports as internal or external without counting external", () => {
    const files = [{ content: "", path: "src/app.ts" }];
    const lookups = buildEvidenceLookups(files, []);
    const tracking = createEvidenceAssembly().dependencyTracking;

    resolveImportEdges("src/app.ts", ["@/ghost", "react"], lookups, tracking);

    expect(tracking.unresolvedImportSpecifiers).toBe(1);
    expect(tracking.unresolvedSamples).toEqual([{ fromPath: "src/app.ts", specifier: "@/ghost" }]);
    expect(tracking.edges).toEqual([
      { fromPath: "src/app.ts", kind: "internal", resolved: false, specifier: "@/ghost" },
      { fromPath: "src/app.ts", kind: "external", resolved: false, specifier: "react" },
    ]);
  });

  it("caps unresolved samples at the schema limit", () => {
    const files = [{ content: "", path: "src/app.ts" }];
    const lookups = buildEvidenceLookups(files, []);
    const tracking = createEvidenceAssembly().dependencyTracking;

    const imports = Array.from({ length: 101 }, (_, index) => `@/ghost${index}`);
    resolveImportEdges("src/app.ts", imports, lookups, tracking);

    expect(tracking.unresolvedImportSpecifiers).toBe(101);
    expect(tracking.unresolvedSamples).toHaveLength(100);
  });
});
