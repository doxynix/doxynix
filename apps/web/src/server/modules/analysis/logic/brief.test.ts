import { describe, expect, it } from "vitest";

import {
  buildInteractiveBriefNodePayload,
  buildInteractiveBriefPanel,
  buildInteractiveBriefPayload,
} from "./brief";

type BriefExplainInput = Parameters<typeof buildInteractiveBriefNodePayload>[0]["explain"];
type BriefStructureNodeInput = Parameters<
  typeof buildInteractiveBriefNodePayload
>[0]["structureNode"];

const makeExplain = (overrides: Record<string, unknown> = {}): BriefExplainInput =>
  ({
    analysisRef: null,
    confidence: "high",
    nextSuggestedPaths: ["src/next.ts"],
    relationships: {},
    role: "Backend structural area",
    sourcePaths: ["src/app.ts"],
    summary: ["Line 1", "Line 2"],
    whyImportant: "Because it matters",
    ...overrides,
  }) as unknown as BriefExplainInput;

const makeStructureNode = (overrides: Record<string, unknown> = {}): BriefStructureNodeInput =>
  ({
    analysisRef: null,
    breadcrumbs: [{ id: "group:src", label: "src", path: "src" }],
    canDrillDeeper: false,
    children: [{ id: "file:a.ts", label: "a.ts", path: "a.ts" }],
    edges: [],
    inspect: { contains: ["a.ts"] },
    node: { id: "file:src/app.ts", label: "app.ts", nodeType: "file", path: "src/app.ts" },
    ...overrides,
  }) as unknown as BriefStructureNodeInput;

describe("buildInteractiveBriefPanel", () => {
  it("собирает панель с действиями для файла", () => {
    const panel = buildInteractiveBriefPanel({
      explain: makeExplain(),
      structureNode: makeStructureNode(),
    });

    expect(panel.availableActions).toEqual({
      canDocumentFile: true,
      canDrillDeeper: false,
      canOpenFileContext: true,
      canQuickAudit: true,
    });
    expect(panel.drilldownPreview).toEqual({
      childCount: 1,
      childLabels: ["a.ts"],
      edgeCount: 0,
    });
    expect(panel.explain).toEqual(
      expect.objectContaining({ confidence: "high", role: "Backend structural area" }),
    );
    expect(panel.node).toEqual({
      id: "file:src/app.ts",
      label: "app.ts",
      nodeType: "file",
      path: "src/app.ts",
    });
  });

  it("для группы с drilldown включает canDrillDeeper и отключает file-действия", () => {
    const panel = buildInteractiveBriefPanel({
      explain: makeExplain(),
      structureNode: makeStructureNode({
        canDrillDeeper: true,
        node: { id: "group:src", label: "src", nodeType: "group", path: "src" },
      }),
    });

    expect(panel.availableActions).toEqual({
      canDocumentFile: false,
      canDrillDeeper: true,
      canOpenFileContext: false,
      canQuickAudit: false,
    });
  });

  it("обрезает childLabels до 8", () => {
    const children = Array.from({ length: 10 }, (_, index) => ({
      id: `file:c${index}.ts`,
      label: `c${index}.ts`,
      path: `c${index}.ts`,
    }));

    const panel = buildInteractiveBriefPanel({
      explain: makeExplain(),
      structureNode: makeStructureNode({ children }),
    });

    expect(panel.drilldownPreview.childLabels).toHaveLength(8);
  });
});

describe("buildInteractiveBriefPayload", () => {
  it("оборачивает панель в panel.defaultNode и отдаёт структуру", () => {
    const payload = buildInteractiveBriefPayload({
      analysisRef: { analysisId: "a1", commitSha: "c1", createdAt: new Date() },
      capabilities: { canDocumentFile: true } as never,
      defaultNodeId: "group:src",
      docsSummary: { generatedDocs: [] } as never,
      overview: { architectureStyle: "monolith" } as never,
      panel: {} as never,
      structure: { edges: [], groups: [], nodes: [] },
    });

    expect(payload.panel.defaultNode).toEqual({});
    expect(payload.selection).toEqual({ defaultNodeId: "group:src" });
    expect(payload.structure).toEqual({ edges: [], groups: [], nodes: [] });
    expect(payload.analysisRef).toEqual(
      expect.objectContaining({ analysisId: "a1", commitSha: "c1" }),
    );
  });
});

describe("buildInteractiveBriefNodePayload", () => {
  it("предпочитает analysisRef из structureNode", () => {
    const payload = buildInteractiveBriefNodePayload({
      explain: makeExplain({ analysisRef: "explain-ref" }),
      structureNode: makeStructureNode({ analysisRef: "structure-ref" }),
    });

    expect(payload.analysisRef).toBe("structure-ref");
    expect(payload.canDrillDeeper).toBe(false);
    expect(payload.children).toEqual([{ id: "file:a.ts", label: "a.ts", path: "a.ts" }]);
    expect(payload.explain.summary).toEqual(["Line 1", "Line 2"]);
  });

  it("фолбэчит на analysisRef из explain", () => {
    const payload = buildInteractiveBriefNodePayload({
      explain: makeExplain({ analysisRef: "explain-ref" }),
      structureNode: makeStructureNode(),
    });

    expect(payload.analysisRef).toBe("explain-ref");
  });
});
