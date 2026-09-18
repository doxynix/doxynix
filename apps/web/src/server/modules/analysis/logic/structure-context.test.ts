import { describe, expect, it } from "vitest";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import {
  aggregateEntryForPaths,
  buildBreadcrumbs,
  collectNodeScopePaths,
} from "./structure-context";
import type { StructureContext } from "./structure-shared";

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    dependencyHotspots: [],
    orphanModules: [],
    ...overrides,
  }) as unknown as RepoMetrics;

const makeContext = (overrides: Partial<StructureContext> = {}): StructureContext =>
  ({
    aiResult: {
      findings: [{ evidence: [{ path: "src/app.ts" }], title: "Risk A" }],
      repository_facts: [{ evidence: [{ path: "src/app.ts" }], title: "Fact A" }],
    } as unknown as AIResult,
    allInterestingPaths: ["src/app.ts", "src/routes.ts", "src/features/x.ts", "api/v1/users.ts"],
    apiPaths: new Set(["src/routes.ts"]),
    docInput: { api: { publicSurfacePaths: ["src/app.ts"] } },
    groupMap: new Map(),
    meaningfulEntrypoints: ["src/app.ts"],
    metrics: makeMetrics({
      entrypointDetails: [{ confidence: 86, kind: "runtime", path: "src/app.ts", reason: "main" }],
      frameworkFacts: [
        { category: "framework", confidence: 0.9, name: "React", sources: ["src/app.ts"] },
      ],
      graphPreviewEdges: [{ fromPath: "src/app.ts", toPath: "src/features/x.ts", weight: 2 }],
    }),
    normalizedConfigInventory: ["src/routes.ts"],
    rawTopLevelEdges: [],
    signalMap: new Map(),
    ...overrides,
  }) as unknown as StructureContext;

describe("buildBreadcrumbs", () => {
  it("builds a chain down to the file node for a file", () => {
    expect(buildBreadcrumbs("file", "src/features/ui/button.tsx")).toEqual([
      expect.objectContaining({ id: "group:src", nodeType: "group", path: "src" }),
      expect.objectContaining({
        id: "group:src/features",
        nodeType: "group",
        path: "src/features",
      }),
      expect.objectContaining({
        id: "group:src/features/ui",
        nodeType: "group",
        path: "src/features/ui",
      }),
      expect.objectContaining({
        id: "file:src/features/ui/button.tsx",
        label: "button.tsx",
        nodeType: "file",
      }),
    ]);
  });

  it("appends a final group node for a group", () => {
    const crumbs = buildBreadcrumbs("group", "src/features");

    expect(crumbs.at(-1)).toEqual(
      expect.objectContaining({ id: "group:src/features", nodeType: "group" }),
    );
    expect(crumbs).toHaveLength(2);
  });

  it("root path yields a single node", () => {
    const crumbs = buildBreadcrumbs("file", "app.ts");

    expect(crumbs).toEqual([
      expect.objectContaining({ id: "file:app.ts", label: "app.ts", nodeType: "file" }),
    ]);
  });
});

describe("collectNodeScopePaths", () => {
  const context = makeContext();

  it("returns the path for a file only when it is interesting", () => {
    expect(collectNodeScopePaths(context, "file", "src/app.ts")).toEqual(["src/app.ts"]);
    expect(collectNodeScopePaths(context, "file", "src/other.ts")).toEqual([]);
  });

  it("filters interesting paths within scope for a group", () => {
    expect(collectNodeScopePaths(context, "group", "src")).toEqual([
      "src/app.ts",
      "src/routes.ts",
      "src/features/x.ts",
    ]);
    expect(collectNodeScopePaths(context, "group", "api")).toEqual(["api/v1/users.ts"]);
  });
});

describe("aggregateEntryForPaths", () => {
  it("aggregates paths, signals, metrics and facts into a group entry", () => {
    const entry = aggregateEntryForPaths(
      ["src/app.ts", "src/routes.ts", "src/app.ts"],
      makeContext(),
    );

    expect(entry.paths).toEqual(["src/app.ts", "src/routes.ts"]);
    expect(entry.apiPaths).toEqual(["src/routes.ts"]);
    expect(entry.configPaths).toEqual(["src/routes.ts"]);
    expect(entry.publicSurfacePaths).toEqual(["src/app.ts"]);
    expect(entry.apiPaths.length).toBe(1);
    expect(entry.entrypointDetails).toEqual([
      { confidence: 86, kind: "runtime", path: "src/app.ts", reason: "main" },
    ]);
    expect(entry.riskTitles).toEqual(["Risk A"]);
    expect(entry.factTitles).toEqual(["Fact A"]);
    expect(entry.frameworkNames).toEqual(["React"]);
    expect(entry.graphNeighborPaths).toEqual(["src/features/x.ts"]);
    expect(
      Object.values(entry.semanticCounts).reduce((sum, count) => sum + count, 0),
    ).toBeGreaterThan(0);
  });

  it("does not add signals for paths outside scope", () => {
    const entry = aggregateEntryForPaths(["zzz/unrelated.ts"], makeContext());

    expect(entry.paths).toEqual(["zzz/unrelated.ts"]);
    expect(entry.apiPaths).toEqual([]);
    expect(entry.riskTitles).toEqual([]);
    expect(entry.frameworkNames).toEqual([]);
  });
});
