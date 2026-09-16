import { describe, expect, it } from "vitest";

import type { NodeContextDiagnostics, NodeContextMeta } from "../analysis.context";
import type { AnalysisRef } from "../analysis.repository";
import { buildSyncFileActionMeta } from "./repo-file-action-state";

const analysisRef = {
  analysisId: "analysis-1",
  commitSha: "abc123",
  createdAt: new Date("2024-01-01"),
} as unknown as AnalysisRef;

const diagnostics: NodeContextDiagnostics = {
  contextStrength: "strong",
  graphNeighborCount: 3,
  hasContext: true,
  neighborPathCount: 2,
  nextSuggestedPathCount: 1,
  nonEmptyBuckets: ["apiNeighbors"],
  recommendedActionCount: 4,
  sourcePathCount: 5,
};

const meta: NodeContextMeta = {
  confidence: "high",
  graphBacked: true,
  mode: "node",
  nodeId: "file:src/app.ts",
  source: "node-explain",
  title: "app.ts",
};

describe("buildSyncFileActionMeta", () => {
  it("прогоняет через поле контекста без изменений", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef,
      contentRef: { analysisId: "analysis-1" },
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.contextDiagnostics).toBe(diagnostics);
    expect(metaResult.contextMeta).toBe(meta);
    expect(metaResult.analysisRef).toBe(analysisRef);
    expect(metaResult.contentRef).toEqual({ analysisId: "analysis-1" });
  });

  it("без analysisRef помечает консистентность как unknown", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef: null,
      contentRef: {},
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.consistency).toBe("unknown");
    expect(metaResult.consistencyNote).toBe(
      "No completed analysis snapshot is available for this repository yet.",
    );
  });

  it("без явной ссылки консистентность unknown", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef,
      contentRef: {},
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.consistency).toBe("unknown");
    expect(metaResult.consistencyNote).toContain("without an explicit analysis reference");
  });

  it("совпадающие analysisId/commitSha дают matched", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef,
      contentRef: { analysisId: "analysis-1", commitSha: "abc123" },
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.consistency).toBe("matched");
  });

  it("несовпадающий commitSha даёт mismatch", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef,
      contentRef: { analysisId: "analysis-1", commitSha: "deadbeef" },
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.consistency).toBe("mismatch");
    expect(metaResult.consistencyNote).toContain(
      "does not match the latest completed analysis snapshot",
    );
  });

  it("несовпадающий analysisId даёт mismatch", () => {
    const metaResult = buildSyncFileActionMeta({
      analysisRef,
      contentRef: { analysisId: "other-analysis" },
      contextDiagnostics: diagnostics,
      contextMeta: meta,
    });

    expect(metaResult.consistency).toBe("mismatch");
  });
});
