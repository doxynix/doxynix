import { describe, expect, it, vi } from "vitest";

import type { RepoWithLatestAnalysisAndDocs } from "../analysis.repository";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import {
  buildStructureMapPayload,
  buildStructureMapPayloadFromContext,
  buildStructureNodePayload,
  buildStructureNodePayloadFromContext,
  buildTopLevelNodes,
} from "./graph-navigator";
import { rankStructureNode } from "./semantics";
import type * as structureContextModule from "./structure-context";
import { buildStructureContext } from "./structure-context";
import {
  createEmptyGroupEntry,
  type StructureContext,
  type StructureGroupEntry,
} from "./structure-shared";

vi.mock("./structure-context", async (importOriginal) => {
  const actual = await importOriginal<typeof structureContextModule>();
  return { ...actual, buildStructureContext: vi.fn() };
});

vi.mock("../analysis.mapper", () => ({
  analysisMapper: { toAnalysisRef: vi.fn(() => null) },
}));

const makeGroupEntry = (
  paths: string[],
  overrides: Partial<StructureGroupEntry> = {},
): StructureGroupEntry => {
  const entry = createEmptyGroupEntry();
  entry.paths.push(...paths);
  return Object.assign(entry, overrides);
};

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    configInventory: [],
    dependencyHotspots: [],
    hotspotFiles: [],
    orphanModules: [],
    techStack: ["TypeScript"],
    ...overrides,
  }) as unknown as RepoMetrics;

const makeAiResult = (): AIResult =>
  ({
    executive_summary: {
      architecture_style: "modular monolith",
      purpose: "Testing platform for engineering teams",
      stack_details: [],
    },
    findings: [],
    repository_facts: [],
  }) as unknown as AIResult;

const makeContext = (overrides: Partial<StructureContext> = {}): StructureContext => ({
  aiResult: makeAiResult(),
  allInterestingPaths: ["src/app.ts", "src/routes.ts", "src/features/x.ts", "api/v1/users.ts"],
  apiPaths: new Set(["src/routes.ts"]),
  docInput: null,
  groupMap: new Map([
    [
      "src",
      makeGroupEntry(["src/app.ts", "src/routes.ts", "src/features/x.ts"], {
        apiPaths: ["src/routes.ts"],
        semanticCounts: { ...createEmptyGroupEntry().semanticCounts, backend: 1 },
      }),
    ],
    [
      "api",
      makeGroupEntry(["api/v1/users.ts"], {
        entrypointDetails: [
          { confidence: 86, kind: "runtime", path: "api/v1/users.ts", reason: "seed" },
        ],
        semanticCounts: { ...createEmptyGroupEntry().semanticCounts, api: 1 },
      }),
    ],
  ]),
  meaningfulEntrypoints: ["src/app.ts"],
  metrics: makeMetrics(),
  normalizedConfigInventory: [],
  rawTopLevelEdges: [],
  signalMap: new Map(),
  ...overrides,
});

const mockedBuildStructureContext = vi.mocked(buildStructureContext);

describe("buildStructureMapPayloadFromContext", () => {
  it("builds the map: overview, filters, groups, inspect and defaultNodeId", () => {
    const context = makeContext({
      rawTopLevelEdges: [{ id: "e1", relation: "api", source: "api", target: "src", weight: 3 }],
    });

    const payload = buildStructureMapPayloadFromContext(context, null);

    expect(payload).not.toBeNull();
    expect(payload.overview).toEqual({
      architectureStyle: "modular monolith",
      primaryEntrypoints: ["src/app.ts"],
      primaryModules: [],
      purpose: "Testing platform for engineering teams",
      repositoryKind: "unknown",
      stack: ["TypeScript"],
    });
    expect(payload.graph.groups).toHaveLength(2);
    expect(payload.graph.nodes).toHaveLength(2);
    expect(payload.graph.edges).toEqual([
      expect.objectContaining({
        id: "group:api-group:src-api",
        relation: "api",
        source: "group:api",
        target: "group:src",
        weight: 3,
      }),
    ]);
    expect(payload.filters.api).toEqual(["group:src"]);
    expect(payload.filters.entrypoints).toEqual(["group:api"]);
    expect(Object.keys(payload.inspect.byNodeId)).toHaveLength(2);
    expect(payload.inspect.byNodeId["group:api"]?.whyImportant).toContain("Public API");
    expect(payload.selection.defaultNodeId).not.toBeNull();
  });

  it("selects the defaultNode from firstLookPaths", () => {
    const context = makeContext({
      docInput: {
        api: { publicSurfacePaths: [] },
        architecture: { dependencyCycles: [] },
        sections: {
          onboarding: { body: { firstLookPaths: ["api/v1/users.ts"] } },
          overview: { body: {} },
        },
      } as unknown as StructureContext["docInput"],
    });

    const payload = buildStructureMapPayloadFromContext(context, null);

    expect(payload.selection.defaultNodeId).toBe("group:api");
    expect(payload.inspect.defaultNodeId).toBe("group:api");
  });

  it("empty groupMap yields an empty graph and null default", () => {
    const payload = buildStructureMapPayloadFromContext(makeContext({ groupMap: new Map() }), null);

    expect(payload.graph.groups).toEqual([]);
    expect(payload.graph.nodes).toEqual([]);
    expect(payload.graph.edges).toEqual([]);
    expect(payload.inspect.byNodeId).toEqual({});
    expect(payload.selection.defaultNodeId).toBeNull();
  });
});

describe("buildTopLevelNodes", () => {
  it("caps the list to 14 nodes and sorts by rank/label", () => {
    const groupMap = new Map<string, StructureGroupEntry>();
    for (let index = 0; index < 16; index++) {
      groupMap.set(`g${index}`, makeGroupEntry([`g${index}/a.ts`]));
    }
    groupMap.set("other", makeGroupEntry(["x/a.ts"]));

    const nodes = buildTopLevelNodes(makeContext({ groupMap }));

    expect(nodes).toHaveLength(14);
    expect(nodes.some((node) => node.path === "other")).toBe(false);
    const expected = nodes
      .map((node) => node)
      .toSorted(
        (left, right) =>
          rankStructureNode(right) - rankStructureNode(left) ||
          left.label.localeCompare(right.label),
      );
    expect(nodes.map((node) => node.id)).toEqual(expected.map((node) => node.id));
  });

  it("prioritizes meaningful nodes over fallback", () => {
    const groupMap = new Map<string, StructureGroupEntry>([
      ["other", makeGroupEntry(["x/a.ts"])],
      [
        "aaa",
        makeGroupEntry(["aaa/main.ts"], {
          entrypointDetails: [
            { confidence: 86, kind: "runtime", path: "aaa/main.ts", reason: "seed" },
          ],
          semanticCounts: { ...createEmptyGroupEntry().semanticCounts, backend: 1 },
        }),
      ],
    ]);

    const nodes = buildTopLevelNodes(makeContext({ groupMap }));

    expect(nodes.map((node) => node.id)).toEqual(["group:aaa", "group:other"]);
  });

  it("empty groupMap yields an empty list", () => {
    expect(buildTopLevelNodes(makeContext({ groupMap: new Map() }))).toEqual([]);
  });
});

describe("buildStructureNodePayloadFromContext (file)", () => {
  it("returns a file payload with breadcrumbs and empty details", () => {
    const payload = buildStructureNodePayloadFromContext(makeContext(), null, "file:src/app.ts");

    expect(payload).not.toBeNull();
    expect(payload?.node).toEqual(
      expect.objectContaining({
        id: "file:src/app.ts",
        label: "app.ts",
        nodeType: "file",
        path: "src/app.ts",
      }),
    );
    expect(payload?.canDrillDeeper).toBe(false);
    expect(payload?.children).toEqual([]);
    expect(payload?.edges).toEqual([]);
    expect(payload?.inspect.contains).toEqual([]);
    expect(payload?.breadcrumbs).toEqual([
      expect.objectContaining({ id: "group:src", nodeType: "group" }),
      expect.objectContaining({ id: "file:src/app.ts", nodeType: "file" }),
    ]);
  });

  it("returns null for a file outside allInterestingPaths", () => {
    const payload = buildStructureNodePayloadFromContext(
      makeContext(),
      null,
      "file:src/missing.ts",
    );

    expect(payload).toBeNull();
  });
});

describe("buildStructureNodePayloadFromContext (group)", () => {
  it("builds children (groups before files) and canDrillDeeper", () => {
    const payload = buildStructureNodePayloadFromContext(makeContext(), null, "group:src");

    expect(payload).not.toBeNull();
    expect(payload?.node).toEqual(expect.objectContaining({ id: "group:src", nodeType: "group" }));
    expect(payload?.canDrillDeeper).toBe(true);
    const childIds = payload?.children.map((child) => child.id) ?? [];
    expect(childIds[0]).toBe("group:src/features");
    expect(childIds).toEqual(expect.arrayContaining(["file:src/app.ts", "file:src/routes.ts"]));
    expect(payload?.breadcrumbs.at(-1)).toEqual(
      expect.objectContaining({ id: "group:src", nodeType: "group" }),
    );
    expect(Array.isArray(payload?.edges)).toBe(true);
    expect(payload?.inspect.contains).toEqual(payload?.children.map((child) => child.label));
  });

  it("returns null for a group without scoped paths", () => {
    const payload = buildStructureNodePayloadFromContext(makeContext(), null, "group:void");

    expect(payload).toBeNull();
  });
});

describe("repo wrappers (buildStructureMapPayload / buildStructureNodePayload)", () => {
  const repo = { analyses: [] } as unknown as RepoWithLatestAnalysisAndDocs;

  it("builds payload via the mocked buildStructureContext", () => {
    mockedBuildStructureContext.mockReturnValue(makeContext());

    const payload = buildStructureMapPayload(repo);

    expect(payload).not.toBeNull();
    expect(payload?.overview.architectureStyle).toBe("modular monolith");
    expect(mockedBuildStructureContext).toHaveBeenCalledWith(repo);
  });

  it("returns null when context is missing", () => {
    mockedBuildStructureContext.mockReturnValue(null);

    expect(buildStructureMapPayload(repo)).toBeNull();
    expect(buildStructureNodePayload(repo, "file:src/app.ts")).toBeNull();
  });

  it("builds node payload via buildStructureNodePayload", () => {
    mockedBuildStructureContext.mockReturnValue(makeContext());

    const payload = buildStructureNodePayload(repo, "file:src/app.ts");

    expect(payload).not.toBeNull();
    expect(payload?.node.id).toBe("file:src/app.ts");
  });
});
