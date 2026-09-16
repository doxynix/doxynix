import { describe, expect, it } from "vitest";

import type { FileSignals, SymbolRef } from "./discovery.types";
import { buildModuleRef, collectFileEvidence, kindForFile } from "./evidence-collector";
import type { DependencyTracking, EvidenceLookups } from "./evidence-support";
import { createEvidenceAssembly } from "./evidence-support";

function makeSignals(overrides: Partial<FileSignals> = {}): FileSignals {
  return {
    analysisMode: "heuristic",
    apiSurface: 0,
    complexityMetrics: { complexity: 0, maxNesting: 0 },
    confidence: 60,
    entrypointHint: false,
    exports: 0,
    imports: [],
    path: "src/app.ts",
    source: "extraction",
    ...overrides,
  };
}

function makeLookups(): Pick<EvidenceLookups, "aliasRules" | "filesByBaseName" | "fileSet"> {
  return { aliasRules: [], fileSet: new Set(), filesByBaseName: new Map() };
}

describe("kindForFile", () => {
  it("maps explicit categories to entrypoint kinds", () => {
    expect(kindForFile("x.ts", ["benchmark"])).toBe("benchmark");
    expect(kindForFile("x.ts", ["test"])).toBe("test");
    expect(kindForFile("x.ts", ["infra"])).toBe("infra");
    expect(kindForFile("x.ts", ["tooling"])).toBe("tooling");
  });

  it("treats scripts and cli directories as tooling", () => {
    expect(kindForFile("scripts/build.ts", ["runtime-source"])).toBe("tooling");
    expect(kindForFile("cli/serve.ts", ["runtime-source"])).toBe("tooling");
  });

  it("treats barrel index files as library and everything else as runtime", () => {
    expect(kindForFile("src/shared/index.ts", ["runtime-source"])).toBe("library");
    expect(kindForFile("src/shared/index.cjs", [])).toBe("library");
    expect(kindForFile("src/shared/index.mts", [])).toBe("library");
    expect(kindForFile("src/main.tsx", ["runtime-source"])).toBe("runtime");
  });

  it("gives categories priority over path prefixes", () => {
    expect(kindForFile("scripts/bench.ts", ["benchmark", "tooling"])).toBe("benchmark");
  });
});

describe("collectFileEvidence", () => {
  it("throws when pre-collected signals are missing", async () => {
    const file = { content: "", path: "src/app.ts" };
    const tracking = createEvidenceAssembly().dependencyTracking;

    await expect(
      collectFileEvidence(file, makeLookups(), tracking, new Map(), () => []),
    ).rejects.toThrow("Missing pre-collected FileSignals for src/app.ts");
  });

  it("falls back to the normalized path when looking up signals", async () => {
    const file = { content: "", path: "src/./app.ts" };
    const signals = makeSignals();
    const tracking = createEvidenceAssembly().dependencyTracking;

    const collected = await collectFileEvidence(
      file,
      makeLookups(),
      tracking,
      new Map([["src/app.ts", signals]]),
      () => [],
    );

    expect(collected.apiSurface).toBe(0);
  });

  it("records a config ref for config files and appends signal config refs", async () => {
    const file = { content: "", path: "tsconfig.json" };
    const signals = makeSignals({
      configRefs: [{ confidence: 70, kind: "extra", path: "extra.json" }],
    });
    const tracking = createEvidenceAssembly().dependencyTracking;

    const collected = await collectFileEvidence(
      file,
      makeLookups(),
      tracking,
      new Map([["tsconfig.json", signals]]),
      () => [],
    );

    expect(collected.configs).toEqual([
      { confidence: 90, kind: "tsconfig.json", path: "tsconfig.json" },
      { confidence: 70, kind: "extra", path: "extra.json" },
    ]);
  });

  it("passes the file imports to the import edge resolver", async () => {
    const file = { content: "", path: "src/app.ts" };
    const signals = makeSignals({ imports: ["react", "./util"] });
    const tracking = createEvidenceAssembly().dependencyTracking;
    const lookups = makeLookups();
    const calls: Array<[string, string[]]> = [];

    const resolveSpy = (
      filePath: string,
      imports: string[],
      _innerLookups: Pick<EvidenceLookups, "aliasRules" | "filesByBaseName" | "fileSet">,
      _innerTracking: DependencyTracking,
    ) => {
      calls.push([filePath, imports]);
      return imports;
    };

    await collectFileEvidence(
      file,
      lookups,
      tracking,
      new Map([["src/app.ts", signals]]),
      resolveSpy,
    );

    expect(calls).toEqual([["src/app.ts", ["react", "./util"]]]);
  });

  it("spreads entrypoint hints, routes, and symbols from the signals", async () => {
    const file = { content: "", path: "src/app.ts" };
    const entrypointRefs = [
      { confidence: 86, kind: "runtime" as const, path: "src/app.ts", reason: "x" },
    ];
    const routes = [{ confidence: 80, kind: "http" as const, path: "/", sourcePath: "src/app.ts" }];
    const symbols: SymbolRef[] = [
      { confidence: 75, exported: true, kind: "function", name: "run", path: "src/app.ts" },
    ];
    const signals = makeSignals({ entrypointRefs, routes, symbols });
    const tracking = createEvidenceAssembly().dependencyTracking;

    const collected = await collectFileEvidence(
      file,
      makeLookups(),
      tracking,
      new Map([["src/app.ts", signals]]),
      () => [],
    );

    expect(collected.entrypointHints).toEqual(entrypointRefs);
    expect(collected.routes).toEqual(routes);
    expect(collected.symbols).toEqual(symbols);
    expect(collected.imports).toEqual([]);
  });
});

describe("buildModuleRef", () => {
  it("uses signal categories when present", () => {
    const ref = buildModuleRef("src/app.ts", makeSignals({ categories: ["docs"] }), []);

    expect(ref.categories).toEqual(["docs"]);
    expect(ref.parseTier).toBe("heuristic");
  });

  it("falls back to policy categories and defaults for missing signal fields", () => {
    const signals = makeSignals({
      analysisMode: "tree-sitter",
      apiSurface: 4,
      exports: 2,
      imports: ["./util"],
    });
    const ref = buildModuleRef("src/app.ts", signals, []);

    expect(ref.categories).toContain("runtime-source");
    expect(ref.apiSurface).toBe(4);
    expect(ref.exports).toBe(2);
    expect(ref.imports).toEqual(["./util"]);
    expect(ref.parseTier).toBe("tree-sitter");
    expect(ref.routeCount).toBe(0);
    expect(ref.frameworkHints).toEqual([]);
    expect(ref.symbols).toEqual([]);
  });

  it("counts routes and keeps provided entrypoint hints", () => {
    const signals = makeSignals({
      routes: [
        { confidence: 80, kind: "rpc", path: "/x", sourcePath: "src/app.ts" },
        { confidence: 70, kind: "http", method: "GET", path: "/y", sourcePath: "src/app.ts" },
      ],
    });
    const ref = buildModuleRef("src/app.ts", signals, [
      { confidence: 86, kind: "runtime", path: "src/app.ts", reason: "x" },
    ]);

    expect(ref.routeCount).toBe(2);
    expect(ref.entrypointHints).toHaveLength(1);
  });
});
