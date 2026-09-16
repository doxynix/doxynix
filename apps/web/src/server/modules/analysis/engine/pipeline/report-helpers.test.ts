import { describe, expect, it } from "vitest";

import {
  buildReferenceEvidencePaths,
  buildSectionInput,
  getPrimaryEntrypointPaths,
  inferRepositoryKind,
  rankArchitectureModule,
  sortArchitectureModules,
} from "./report-helpers";

describe("report-helpers", () => {
  it("ranks modules by exported API and route traffic", () => {
    const modules = [
      { apiSurface: 4, exports: 3, path: "src/shared.ts", routeCount: 2, symbols: [] },
      { apiSurface: 9, exports: 7, path: "src/entry.ts", routeCount: 8, symbols: [{ name: "a" }] },
    ] as any;

    expect(rankArchitectureModule(modules[0])).toBe(4 * 6 + 2 * 5 + 3 * 2 + 0);

    const sortedModules = sortArchitectureModules(modules);
    const firstModule = sortedModules[0];
    expect(firstModule).toBeDefined();
    if (!firstModule) {
      throw new Error("Expected at least one sorted module");
    }
    expect(firstModule.path).toBe("src/entry.ts");
  });

  it("filters entrypoints and infers repository kind", () => {
    const entrypoints = [
      { kind: "library", path: "src/index.ts" },
      { kind: "runtime", path: "src/server.ts" },
      { kind: "test", path: "src/test.ts" },
    ] as any;

    expect(getPrimaryEntrypointPaths(entrypoints)).toEqual(["src/index.ts", "src/server.ts"]);
    expect(
      inferRepositoryKind({
        primaryEntrypoints: ["src/index.ts", "src/server.ts"],
        routeInventory: { estimatedOperations: 3 } as any,
      }),
    ).toBe("mixed");
  });

  it("clamps confidence on section input and deduplicates evidence paths", () => {
    const input = buildSectionInput({
      audience: "mixed",
      body: { ok: true },
      confidence: 140,
      evidencePaths: ["src/a.ts", "src/a.ts", undefined, null, false],
      section: "overview",
      summary: ["summary"],
      title: "Overview",
      unknowns: [],
    });

    expect(input.confidence).toBe(100);
    expect(input.evidencePaths).toEqual(["src/a.ts"]);
  });

  it("builds reference evidence from primary entrypoints before falling back to modules", () => {
    const references = buildReferenceEvidencePaths({
      modules: [{ apiSurface: 3, exports: 2, path: "src/legacy.ts", routeCount: 1, symbols: [] }],
      primaryEntrypoints: ["src/index.ts", "src/server.ts"],
    });

    expect(references).toEqual(["src/index.ts", "src/server.ts"]);
  });
});
