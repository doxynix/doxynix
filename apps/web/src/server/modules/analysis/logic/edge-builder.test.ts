import { describe, expect, it } from "vitest";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { buildDrilldownEdges, createStructuralContextEdges } from "./edge-builder";
import type { StructureContext, StructureGroupEntry } from "./structure-shared";

const emptyGroupEntry = (semanticCounts: Record<string, number> = {}): StructureGroupEntry => ({
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
  semanticCounts: {
    api: 0,
    backend: 0,
    config: 0,
    core: 0,
    data: 0,
    frontend: 0,
    infrastructure: 0,
    ml: 0,
    mobile: 0,
    shared: 0,
    unknown: 0,
    ...semanticCounts,
  },
});

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    configInventory: [],
    dependencyHotspots: [],
    entrypoints: [],
    hotspotFiles: [],
    ...overrides,
  }) as unknown as RepoMetrics;

describe("createStructuralContextEdges", () => {
  it("пустые входы дают пустой список рёбер", () => {
    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(),
      groupMap: new Map(),
      metrics: makeMetrics(),
    });

    expect(result).toEqual([]);
  });

  it("строит топологические рёбра между семантическими группами", () => {
    const groupMap = new Map<string, StructureGroupEntry>([
      ["src", emptyGroupEntry({ backend: 1 })],
      ["api", emptyGroupEntry({ api: 1 })],
      ["web", emptyGroupEntry({ frontend: 1 })],
      ["packages", emptyGroupEntry({ shared: 1 })],
    ]);

    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(),
      groupMap,
      metrics: makeMetrics({ entrypoints: ["src/app.ts"] }),
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: "api", source: "api", target: "src", weight: 4 }),
        expect.objectContaining({
          relation: "entrypoint",
          source: "src/app.ts",
          target: "api",
          weight: 4,
        }),
        expect.objectContaining({
          relation: "entrypoint",
          source: "src/app.ts",
          target: "src",
          weight: 3,
        }),
        expect.objectContaining({ relation: "focus", source: "web", target: "api", weight: 3 }),
        expect.objectContaining({
          relation: "focus",
          source: "web",
          target: "packages",
          weight: 2,
        }),
      ]),
    );
  });

  it("рёбра сортируются по убыванию веса", () => {
    const groupMap = new Map<string, StructureGroupEntry>([
      ["src", emptyGroupEntry({ backend: 1 })],
      ["api", emptyGroupEntry({ api: 1 })],
    ]);

    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(),
      groupMap,
      metrics: makeMetrics({ entrypoints: ["src/app.ts"] }),
    });

    const weights = result.map((edge) => edge.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("graphPreviewEdges: api-отношение по apiPaths, скип same-group и чувствительных путей", () => {
    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(["src/app/a.ts"]),
      groupMap: new Map(),
      metrics: makeMetrics({
        graphPreviewEdges: [
          { fromPath: "src/app/a.ts", toPath: "api/routes.ts", weight: 2 },
          { fromPath: "src/app/lib/a.ts", toPath: "src/app/lib/b.ts", weight: 9 },
          { fromPath: ".env", toPath: "api/routes.ts", weight: 5 },
        ],
      }),
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "src/app/a.ts-api-api",
        relation: "api",
        source: "src/app/a.ts",
        target: "api",
        weight: 2,
      }),
    ]);
  });

  it("капает результат до 24 рёбер и сохраняет сортировку", () => {
    const graphPreviewEdges = Array.from({ length: 30 }, (_, i) => ({
      fromPath: `g${i}/a.ts`,
      toPath: `g${i + 10}/a.ts`,
      weight: 30 - i,
    }));

    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(),
      groupMap: new Map(),
      metrics: makeMetrics({ graphPreviewEdges }),
    });

    expect(result).toHaveLength(24);
    expect(result[0]?.weight).toBe(30);
    const weights = result.map((edge) => edge.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("добавляет cycle-рёбра из dependencyCycles и entrypoint-рёбра к primaryModules", () => {
    const metrics = makeMetrics({
      documentationInput: {
        api: { publicSurfacePaths: [] },
        architecture: { dependencyCycles: [["api/routes.ts", "src/app.ts"]] },
        sections: {
          onboarding: {
            body: {
              apiPaths: [],
              configPaths: [],
              firstLookPaths: [],
              newcomerSteps: [],
              riskPaths: [],
            },
          },
          overview: { body: { primaryModules: ["src/app.ts"] } },
        },
      } as unknown as RepoMetrics["documentationInput"],
      entrypoints: ["api/routes.ts"],
    });

    const result = createStructuralContextEdges({
      aiResult: {} as unknown as AIResult,
      apiPaths: new Set(),
      groupMap: new Map(),
      metrics,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relation: "cycle",
          source: "api",
          target: "src/app.ts",
          weight: 3,
        }),
        expect.objectContaining({
          relation: "cycle",
          source: "src/app.ts",
          target: "api",
          weight: 3,
        }),
        expect.objectContaining({
          relation: "entrypoint",
          source: "api",
          target: "src/app.ts",
          weight: 3,
        }),
      ]),
    );
  });

  it("учитывает evidence из findings (risk) и repository_facts (focus)", () => {
    const aiResult = {
      findings: [{ evidence: [{ path: "hot/a.ts" }, { path: "deploy/util.ts" }], title: "F1" }],
      repository_facts: [
        { evidence: [{ path: "hot/a.ts" }, { path: "deploy/util.ts" }], title: "R1" },
      ],
    } as unknown as AIResult;
    const groupMap = new Map<string, StructureGroupEntry>([
      ["hot", emptyGroupEntry()],
      ["deploy", emptyGroupEntry()],
    ]);

    const result = createStructuralContextEdges({
      aiResult,
      apiPaths: new Set(),
      groupMap,
      metrics: makeMetrics({ hotspotFiles: ["hot/a.ts"] }),
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: "risk", source: "hot", target: "deploy", weight: 2 }),
        expect.objectContaining({ relation: "risk", source: "deploy", target: "hot", weight: 2 }),
        expect.objectContaining({ relation: "focus", source: "hot", target: "deploy", weight: 1 }),
        expect.objectContaining({ relation: "focus", source: "deploy", target: "hot", weight: 1 }),
      ]),
    );
  });
});

describe("buildDrilldownEdges", () => {
  const childNodes = [
    {
      id: "file:src/app.ts",
      kind: "backend",
      markers: { api: false, config: false },
      nodeType: "file" as const,
      path: "src/app.ts",
    },
    {
      id: "file:src/routes.ts",
      kind: "api",
      markers: { api: false, config: false },
      nodeType: "file" as const,
      path: "src/routes.ts",
    },
    {
      id: "group:src/features",
      kind: "frontend",
      markers: { api: false, config: false },
      nodeType: "group" as const,
      path: "src/features",
    },
  ];

  const makeContext = (overrides: Partial<StructureContext> = {}): StructureContext =>
    ({
      aiResult: {} as unknown as AIResult,
      allInterestingPaths: [],
      apiPaths: new Set(),
      docInput: null,
      groupMap: new Map(),
      meaningfulEntrypoints: [],
      metrics: makeMetrics(),
      normalizedConfigInventory: [],
      rawTopLevelEdges: [],
      signalMap: new Map(),
      ...overrides,
    }) as unknown as StructureContext;

  it("строит двунаправленное ребро по graphPreviewEdges с relation api", () => {
    const context = makeContext({
      apiPaths: new Set(["src/routes.ts"]),
      metrics: makeMetrics({
        graphPreviewEdges: [{ fromPath: "src/app.ts", toPath: "src/routes.ts", weight: 3 }],
      }),
    });

    const result = buildDrilldownEdges({ childNodes, context, parentPath: "src" });

    expect(result).toEqual([
      expect.objectContaining({
        id: "file:src/app.ts-file:src/routes.ts-api",
        relation: "api",
        source: "file:src/app.ts",
        target: "file:src/routes.ts",
        weight: 4,
      }),
      expect.objectContaining({
        relation: "api",
        source: "file:src/routes.ts",
        target: "file:src/app.ts",
        weight: 4,
      }),
    ]);
  });

  it("игнорирует пути вне parentPath и одиночные child-узлы (рёбер нет)", () => {
    const context = makeContext({
      meaningfulEntrypoints: ["other/file.ts", "src/app.ts"],
      metrics: makeMetrics({
        graphPreviewEdges: [{ fromPath: "src/app.ts", toPath: "outside/other.ts", weight: 1 }],
      }),
    });

    const result = buildDrilldownEdges({ childNodes, context, parentPath: "src" });

    expect(result).toEqual([]);
  });
});
