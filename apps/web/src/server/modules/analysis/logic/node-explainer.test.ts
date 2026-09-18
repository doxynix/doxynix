import { describe, expect, it } from "vitest";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import type { StructureNodePayload } from "./graph-navigator";
import { buildNodeExplainPayloadFromContext } from "./node-explainer";
import type { StructureContext } from "./structure-shared";

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    dependencyHotspots: [],
    orphanModules: [],
    ...overrides,
  }) as unknown as RepoMetrics;

const makeContext = (overrides: Partial<StructureContext> = {}): StructureContext => ({
  aiResult: {
    findings: [{ evidence: [{ path: "src/app.ts" }], title: "Finding X" }],
    repository_facts: [{ evidence: [{ path: "src/app.ts" }], title: "Fact X" }],
  } as unknown as AIResult,
  allInterestingPaths: ["src/app.ts", "src/routes.ts"],
  apiPaths: new Set(["src/routes.ts"]),
  docInput: null,
  groupMap: new Map(),
  meaningfulEntrypoints: ["src/app.ts"],
  metrics: makeMetrics(),
  normalizedConfigInventory: [],
  rawTopLevelEdges: [],
  signalMap: new Map(),
  ...overrides,
});

const makeDrilldown = (overrides: Record<string, unknown> = {}): StructureNodePayload =>
  ({
    breadcrumbs: [{ id: "group:src", label: "src", path: "src" }],
    canDrillDeeper: false,
    children: [],
    edges: [],
    inspect: {
      apiHints: [],
      configHints: [],
      contains: ["app.ts"],
      dependsOn: [],
      entrypointReason: null,
      frameworkHints: [],
      gitHints: [],
      graphHints: [],
      hotspotHints: [],
      neighborBuckets: {},
      neighborPaths: [],
      nextSuggestedPaths: ["src/routes.ts"],
      recommendedActions: ["Inspect entry flow first"],
      relatedPaths: [],
      reviewPriority: { level: "high", reason: "risky" },
      usedBy: [],
      whyImportant: "Important area",
    },
    node: {
      id: "file:src/app.ts",
      kind: "backend",
      label: "app.ts",
      markers: {
        api: false,
        config: false,
        entrypoint: true,
        risk: false,
        server: false,
        shared: false,
      },
      nodeType: "file",
      path: "src/app.ts",
      stats: { apiCount: 0, entrypointCount: 1 },
    },
    ...overrides,
  }) as unknown as StructureNodePayload;

const analysisRef = { analysisId: "a1", commitSha: "c1", createdAt: new Date("2024-01-01") };

describe("buildNodeExplainPayloadFromContext", () => {
  it("builds an explanation payload for a node with scoped paths", () => {
    const payload = buildNodeExplainPayloadFromContext(
      makeContext(),
      analysisRef,
      "file:src/app.ts",
      makeDrilldown(),
    );

    expect(payload).not.toBeNull();
    expect(payload?.node).toEqual({
      id: "file:src/app.ts",
      kind: "backend",
      label: "app.ts",
      nodeType: "file",
      path: "src/app.ts",
    });
    expect(payload?.analysisRef).toEqual(analysisRef);
    expect(payload?.relationships.riskTitles).toEqual(["Finding X"]);
    expect(payload?.relationships.factTitles).toEqual(["Fact X"]);
    expect(payload?.relationships.entrypoint).toBe(true);
    expect(payload?.relationships.entrypointReason).toBeNull();
    expect(payload?.nextSuggestedPaths).toEqual(["src/routes.ts"]);
    expect(payload?.role).toBe("File with localized entrypoint significance");
    expect(payload?.confidence).toEqual(expect.stringMatching(/^(high|medium|low)$/u));
    expect(payload?.whyImportant).toBe("Important area");
    expect(payload?.summary[0]).toBe(
      "app.ts acts as a file with localized entrypoint significance.",
    );
  });

  it("limits sourcePaths to 8 unique paths and deduplicates", () => {
    const payload = buildNodeExplainPayloadFromContext(
      makeContext(),
      null,
      "file:src/app.ts",
      makeDrilldown(),
    );

    expect(payload?.sourcePaths).toEqual(["src/app.ts"]);
  });

  it("returns null for a node outside interesting paths", () => {
    const payload = buildNodeExplainPayloadFromContext(
      makeContext(),
      null,
      "file:src/missing.ts",
      makeDrilldown(),
    );

    expect(payload).toBeNull();
  });

  it("for a group, builds a payload with group markers", () => {
    const payload = buildNodeExplainPayloadFromContext(
      makeContext(),
      null,
      "group:src",
      makeDrilldown({
        node: {
          id: "group:src",
          kind: "frontend",
          label: "src",
          markers: {
            api: false,
            config: false,
            entrypoint: false,
            risk: false,
            server: false,
            shared: false,
          },
          nodeType: "group",
          path: "src",
          stats: { apiCount: 1, entrypointCount: 0 },
        },
      }),
    );

    expect(payload).not.toBeNull();
    expect(payload?.node.nodeType).toBe("group");
  });
});
