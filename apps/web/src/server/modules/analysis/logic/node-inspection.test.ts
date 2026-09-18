import { describe, expect, it } from "vitest";

import {
  buildNeighborBucketsForEntry,
  buildNeighborPathsForEntry,
  buildRecommendedActions,
  buildReviewPriority,
  buildSuggestedPathsForEntry,
  type StructureInspectEntryLike,
  type StructureInspectNodeLike,
} from "./node-inspection";

const emptyEntry = (): StructureInspectEntryLike => ({
  apiPaths: [],
  changeCoupling: [],
  churnHotspots: [],
  configPaths: [],
  dependencyHotspots: [],
  entrypointDetails: [],
  graphNeighborPaths: [],
  graphUnresolvedSamples: [],
  hotspotSignals: [],
  orphanPaths: [],
  paths: [],
  publicSurfacePaths: [],
  riskTitles: [],
});

const makeNode = (overrides: Partial<StructureInspectNodeLike> = {}): StructureInspectNodeLike => ({
  canDrillDeeper: false,
  markers: { api: false, config: false, entrypoint: false },
  nodeType: "file",
  ...overrides,
});

describe("buildSuggestedPathsForEntry", () => {
  it("prioritizes relatedChildPaths and excludes currentPath", () => {
    const entry = {
      ...emptyEntry(),
      graphNeighborPaths: ["neighbor.ts"],
      paths: ["src"],
    };

    const result = buildSuggestedPathsForEntry({
      context: { docInput: null },
      currentPath: "src/other.ts",
      entry,
      relatedChildPaths: ["src/related.ts", "src/app.ts"],
    });

    expect(result[0]).toBe("src/related.ts");
    expect(result).not.toContain("src/other.ts");
    expect(result).toEqual(expect.arrayContaining(["src/app.ts", "neighbor.ts"]));
  });

  it("includes firstLookPaths inside scope and caps at 6 paths", () => {
    const entry = { ...emptyEntry(), paths: ["src"] };

    const result = buildSuggestedPathsForEntry({
      context: {
        docInput: {
          sections: {
            onboarding: { body: { firstLookPaths: ["src/onboard.ts", "lib/outside.ts"] } },
          },
        },
      },
      currentPath: "src/current.ts",
      entry,
      relatedChildPaths: [],
    });

    expect(result).toContain("src/onboard.ts");
    expect(result).not.toContain("lib/outside.ts");
    expect(result.length).toBeLessThanOrEqual(6);
  });
});

describe("buildNeighborPathsForEntry", () => {
  it("inverts the coupled pair relative to currentPath", () => {
    const entry = {
      ...emptyEntry(),
      changeCoupling: [
        { fromPath: "a.ts", toPath: "b.ts" },
        { fromPath: "c.ts", toPath: "a.ts" },
      ],
    };

    const result = buildNeighborPathsForEntry({
      currentPath: "a.ts",
      entry,
      relatedChildPaths: [],
    });

    expect(result).toEqual(expect.arrayContaining(["b.ts", "c.ts"]));
    expect(result).not.toContain("a.ts");
  });
});

describe("buildNeighborBucketsForEntry", () => {
  it("distributes neighbors into buckets without currentPath", () => {
    const entry = {
      ...emptyEntry(),
      apiPaths: ["api/routes.ts"],
      dependencyHotspots: [{ exports: 1, inbound: 2, outbound: 3, path: "dep/b.ts" }],
      entrypointDetails: [{ path: "src/app.ts" }],
      graphNeighborPaths: ["g/c.ts"],
      hotspotSignals: [{ churnScore: 1, complexity: 1, path: "hot/a.ts", score: 5 }],
      publicSurfacePaths: ["api/public.ts"],
    };

    const result = buildNeighborBucketsForEntry({
      currentPath: "src/app.ts",
      entry,
      relatedChildPaths: [],
    });

    expect(result.apiNeighbors).toEqual(expect.arrayContaining(["api/routes.ts", "api/public.ts"]));
    expect(result.riskNeighbors).toEqual(expect.arrayContaining(["hot/a.ts", "dep/b.ts"]));
    expect(result.entryNeighbors).not.toContain("src/app.ts");
    expect(result.entryNeighbors).toHaveLength(0);
    expect(result.graphNeighbors).toEqual(["g/c.ts"]);
    expect(result.configNeighbors).toEqual([]);
  });
});

describe("buildReviewPriority", () => {
  it("high priority when score >= 10", () => {
    const entry = {
      ...emptyEntry(),
      hotspotSignals: [
        { churnScore: 1, complexity: 1, path: "a.ts", score: 1 },
        { churnScore: 1, complexity: 1, path: "b.ts", score: 1 },
        { churnScore: 1, complexity: 1, path: "c.ts", score: 1 },
        { churnScore: 1, complexity: 1, path: "d.ts", score: 1 },
        { churnScore: 1, complexity: 1, path: "e.ts", score: 1 },
      ],
    };

    expect(buildReviewPriority({ entry, node: makeNode() })).toEqual({
      level: "high",
      reason: "This node combines high-impact structural or change-risk signals.",
    });
  });

  it("medium priority when score >= 5", () => {
    const entry = { ...emptyEntry(), riskTitles: ["a", "b", "c"] };

    expect(buildReviewPriority({ entry, node: makeNode() })).toEqual({
      level: "medium",
      reason: "This node has enough structural or git-history signals to deserve a careful review.",
    });
  });

  it("low priority otherwise", () => {
    const priority = buildReviewPriority({ entry: emptyEntry(), node: makeNode() });

    expect(priority.level).toBe("low");
    expect(priority.reason).toContain("relatively localized");
  });
});

describe("buildRecommendedActions", () => {
  it("collects actions from markers and caps at 5", () => {
    const entry = {
      ...emptyEntry(),
      changeCoupling: [{ fromPath: "a.ts", toPath: "b.ts" }],
      churnHotspots: [{ path: "c.ts" }],
      graphNeighborPaths: ["n.ts"],
      hotspotSignals: [{ churnScore: 1, complexity: 1, path: "h.ts", score: 2 }],
    };

    const actions = buildRecommendedActions({
      entry,
      node: makeNode({
        markers: { api: true, config: true, entrypoint: true },
      }),
    });

    expect(actions).toEqual([
      "Inspect entry flow first",
      "Review API/public surface",
      "Run quick audit before editing",
      "Check git neighbors before refactor",
      "Inspect graph neighbors before editing",
    ]);
  });

  it("suggests drill deeper for a splittable group", () => {
    const actions = buildRecommendedActions({
      entry: emptyEntry(),
      node: makeNode({ canDrillDeeper: true, nodeType: "group" }),
    });

    expect(actions).toContain("Drill deeper into this area");
    expect(actions).not.toContain("Generate file documentation");
  });
});
