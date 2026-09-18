import { describe, expect, it } from "vitest";

import { buildInspectPayload } from "./inspect";
import { summarizeGroupImportance } from "./semantics";

type TestStructureEntry = {
  apiPaths: string[];
  changeCoupling: Array<{ commits: number; fromPath: string; toPath: string }>;
  churnHotspots: Array<{ commitsInWindow: number; path: string }>;
  configPaths: string[];
  dependencyHotspots: Array<{ exports: number; inbound: number; outbound: number; path: string }>;
  entrypointDetails: Array<{ path: string; reason?: null | string }>;
  factTitles: string[];
  frameworkNames: string[];
  graphNeighborPaths: string[];
  graphUnresolvedSamples: Array<{ fromPath: string; specifier: string }>;
  hotspotSignals: Array<{ churnScore: number; complexity: number; path: string; score: number }>;
  orphanPaths: string[];
  paths: string[];
  publicSurfacePaths: string[];
  riskTitles: string[];
};

const emptyEntry = (): TestStructureEntry => ({
  apiPaths: [],
  changeCoupling: [],
  churnHotspots: [],
  configPaths: [],
  dependencyHotspots: [],
  entrypointDetails: [],
  factTitles: [],
  frameworkNames: [],
  graphNeighborPaths: [],
  graphUnresolvedSamples: [],
  hotspotSignals: [],
  orphanPaths: [],
  paths: [],
  publicSurfacePaths: [],
  riskTitles: [],
});

const makeNode = (overrides: Record<string, unknown> = {}) =>
  ({
    canDrillDeeper: false,
    kind: "backend",
    label: "src/app.ts",
    markers: { api: false, config: false, entrypoint: false },
    nodeType: "file",
    path: "src/app.ts",
    previewPaths: ["src/app.ts"],
    stats: {
      apiCount: 0,
      changeCouplingCount: 0,
      churnCount: 0,
      configCount: 0,
      dependencyHotspotCount: 0,
      entrypointCount: 0,
      frameworkCount: 0,
      graphWarningCount: 0,
      hotspotCount: 0,
      orphanCount: 0,
      pathCount: 1,
      riskCount: 0,
    },
    ...overrides,
  }) as Parameters<typeof buildInspectPayload>[0]["node"];

type NodeLike = Parameters<typeof buildInspectPayload>[0]["node"];

const makeInspectNode = (overrides: Record<string, unknown> = {}): NodeLike => makeNode(overrides);

const summarizeImportance = (
  input: Parameters<Parameters<typeof buildInspectPayload>[0]["summarizeImportance"]>[0],
): string =>
  summarizeGroupImportance({
    ...input,
    primaryKind: input.primaryKind as Parameters<typeof summarizeGroupImportance>[0]["primaryKind"],
  });

describe("buildInspectPayload", () => {
  it("collects hints from the entry signals", () => {
    const entry = {
      ...emptyEntry(),
      apiPaths: ["src/api/route1.ts"],
      changeCoupling: [{ commits: 4, fromPath: "src/a.ts", toPath: "src/b.ts" }],
      churnHotspots: [{ commitsInWindow: 12, path: "src/hot.ts" }],
      configPaths: ["tsconfig.json"],
      dependencyHotspots: [{ exports: 3, inbound: 1, outbound: 2, path: "src/dep.ts" }],
      entrypointDetails: [{ path: "src/main.ts", reason: "manifest main" }],
      factTitles: ["Fact A"],
      frameworkNames: ["React", "React"],
      graphNeighborPaths: ["src/neighbor.ts"],
      graphUnresolvedSamples: [{ fromPath: "src/a.ts", specifier: "pkg" }],
      hotspotSignals: [{ churnScore: 2, complexity: 5, path: "src/hot.ts", score: 7 }],
      orphanPaths: ["src/isolated.ts"],
      publicSurfacePaths: ["src/api/public.ts"],
    };

    const node = makeInspectNode({
      stats: { ...makeInspectNode().stats, apiCount: 2, hotspotCount: 1 },
    });

    const payload = buildInspectPayload({
      entry,
      incoming: ["group:src"],
      node,
      outgoing: ["group:api"],
      semanticLabel: "Backend",
      summarizeImportance,
    });

    expect(payload.kind).toBe("Backend");
    expect(payload.title).toBe("src/app.ts");
    expect(payload.apiHints).toEqual(
      expect.arrayContaining([
        "API-facing paths in this area: 2.",
        expect.stringContaining("Public surface paths"),
      ]),
    );
    expect(payload.configHints).toEqual(["tsconfig.json"]);
    expect(payload.frameworkHints).toEqual(["React"]);
    expect(payload.factTitles).toEqual(["Fact A"]);
    expect(payload.entrypointReason).toBe("manifest main");
    expect(payload.dependsOn).toEqual(["group:api"]);
    expect(payload.usedBy).toEqual(["group:src"]);
    expect(payload.samplePaths).toEqual(["src/app.ts"]);
    expect(payload.hotspotHints).toEqual([
      expect.stringContaining("src/hot.ts looks hotspot-prone (score 7, complexity 5, churn 2)"),
      expect.stringContaining(
        "src/dep.ts is dependency-central (inbound 1, outbound 2, exports 3)",
      ),
    ]);
    expect(payload.gitHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "src/hot.ts changed frequently in recent history (12 commits in window)",
        ),
        expect.stringContaining("src/a.ts and src/b.ts often change together (4 coupled commits)"),
      ]),
    );
    expect(payload.graphHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Graph-connected neighbors: src/neighbor.ts."),
        expect.stringContaining("Possibly isolated runtime paths: src/isolated.ts."),
        expect.stringContaining("Dependency resolution is partial here: src/a.ts -> pkg."),
      ]),
    );
    expect(payload.reviewPriority).toEqual(expect.objectContaining({ level: expect.any(String) }));
    expect(payload.recommendedActions.length).toBeGreaterThan(0);
    expect(payload.whyImportant).toContain("This area");
  });

  it("nextSuggestedPaths is empty without context", () => {
    const payload = buildInspectPayload({
      entry: emptyEntry(),
      incoming: [],
      node: makeInspectNode(),
      outgoing: [],
      semanticLabel: "Backend",
      summarizeImportance,
    });

    expect(payload.nextSuggestedPaths).toEqual([]);
    expect(payload.neighborPaths).toEqual([]);
    expect(payload.relatedPaths).toEqual([]);
  });

  it("with context, accounts for firstLookPaths from docInput", () => {
    const entry = { ...emptyEntry(), paths: ["src"] };

    const payload = buildInspectPayload({
      context: {
        docInput: {
          sections: {
            onboarding: { body: { firstLookPaths: ["src/onboard.ts"] } },
          },
        },
      },
      currentPath: "src/other.ts",
      entry,
      incoming: [],
      node: makeInspectNode(),
      outgoing: [],
      semanticLabel: "Backend",
      summarizeImportance,
    });

    expect(payload.nextSuggestedPaths).toEqual(["src/onboard.ts"]);
  });

  it("apiHints are empty when the api counter is zero", () => {
    const payload = buildInspectPayload({
      entry: { ...emptyEntry(), apiPaths: ["src/api/route.ts"] },
      incoming: [],
      node: makeInspectNode(),
      outgoing: [],
      semanticLabel: "Backend",
      summarizeImportance,
    });

    expect(payload.apiHints).toEqual([]);
  });
});
