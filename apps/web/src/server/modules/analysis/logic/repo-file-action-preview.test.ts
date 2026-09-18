import { describe, expect, it, vi } from "vitest";

import type { AnalysisRef } from "../analysis.repository";
import type { DocumentFilePreviewResult, QuickFileAuditResult } from "../analysis.schemas";
import { formatQuickFileAuditMarkdown } from "../analysis.utils";
import { toDocumentFilePreview, toQuickFileAuditPreview } from "./repo-file-action-preview";
import type { SyncFileActionMeta } from "./repo-file-action-state";

vi.mock("../analysis.utils", () => ({
  formatQuickFileAuditMarkdown: vi.fn(
    (result: QuickFileAuditResult) => `# Audit of ${result.path}`,
  ),
}));

const mockFormat = vi.mocked(formatQuickFileAuditMarkdown);

const analysisRef = { analysisId: "analysis-1", commitSha: "abc123" } as unknown as AnalysisRef;

const makeContext = (overrides: Partial<SyncFileActionMeta["contextDiagnostics"]>) =>
  ({
    contextStrength: "light",
    graphNeighborCount: 0,
    hasContext: true,
    neighborPathCount: 0,
    nextSuggestedPathCount: 0,
    nonEmptyBuckets: [],
    recommendedActionCount: 0,
    sourcePathCount: 0,
    ...overrides,
  }) as unknown as SyncFileActionMeta["contextDiagnostics"];

const makeMeta = (overrides: Partial<SyncFileActionMeta["contextMeta"]>) => ({
  confidence: null,
  graphBacked: false,
  mode: "node" as const,
  nodeId: "file:src/app.ts",
  source: "node-explain" as const,
  title: "app.ts",
  ...overrides,
});

const makeAuditResult = (
  overrides: Partial<QuickFileAuditResult> & Partial<SyncFileActionMeta> = {},
): QuickFileAuditResult & SyncFileActionMeta => ({
  analysisRef,
  confidence: "high",
  consistency: "matched",
  consistencyNote: "matches",
  contentRef: { analysisId: "analysis-1" },
  contextDiagnostics: makeContext({}),
  contextMeta: makeMeta({}),
  issues: ["risk 1"],
  path: "src/app.ts",
  strengths: ["clear structure"],
  suggestions: ["add tests"],
  summary: "Solid module.",
  ...overrides,
});

const makeDocResult = (
  overrides: Partial<DocumentFilePreviewResult> & Partial<SyncFileActionMeta> = {},
): DocumentFilePreviewResult & SyncFileActionMeta => ({
  analysisRef,
  confidence: "medium",
  consistency: "unknown",
  consistencyNote: "no snapshot",
  contentRef: {},
  contextDiagnostics: makeContext({}),
  contextMeta: makeMeta({}),
  documentation: "# Docs for src/app.ts",
  edits: [],
  path: "src/app.ts",
  summary: "Documents the module.",
  ...overrides,
});

describe("toQuickFileAuditPreview", () => {
  it("corrects contextNote when context is absent", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({ contextDiagnostics: makeContext({ hasContext: false }) }),
    );

    expect(result.action).toBe("quick-file-audit");
    expect(result.title).toBe("Quick file audit (file-only)");
    expect(result.summary).toBe(
      "Solid module. Generated without selected-node repository context.",
    );
    expect(result.content).toBe(
      "> Generated without selected-node repository context.\n\n# Audit of src/app.ts",
    );
  });

  it("graph-backed with strong context yields (graph-backed) status", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({
        contextDiagnostics: makeContext({ contextStrength: "strong" }),
        contextMeta: makeMeta({ graphBacked: true }),
      }),
    );

    expect(result.title).toBe("Quick file audit (graph-backed)");
    expect(result.summary).toBe(
      "Solid module. Built with strong graph-backed repository context from the selected node and its neighbors.",
    );
  });

  it("graph-backed with moderate context", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({
        contextDiagnostics: makeContext({ contextStrength: "moderate" }),
        contextMeta: makeMeta({ graphBacked: true }),
      }),
    );

    expect(result.summary).toBe(
      "Solid module. Built with graph-backed repository context from the selected node and nearby structural neighbors.",
    );
  });

  it("graph-backed with light context warns about verification", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({
        contextDiagnostics: makeContext({ contextStrength: "light" }),
        contextMeta: makeMeta({ graphBacked: true }),
      }),
    );

    expect(result.title).toBe("Quick file audit (graph-backed)");
    expect(result.summary).toContain(
      "Built with light graph-backed node context; verify nearby files before acting on it.",
    );
    expect(result.content).toContain(
      "> Built with light graph-backed node context; verify nearby files before acting on it.",
    );
  });

  it("node-level context without graph-neighbor support", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({ contextDiagnostics: makeContext({ contextStrength: "strong" }) }),
    );

    expect(result.summary).toContain(
      "Built with node-level repository context, but without resolved graph-neighbor support.",
    );
    expect(result.title).toBe("Quick file audit (context-aware)");
  });

  it("light context without graph-backing stays context-aware", () => {
    const result = toQuickFileAuditPreview(
      makeAuditResult({ contextDiagnostics: makeContext({ contextStrength: "light" }) }),
    );

    expect(result.title).toBe("Quick file audit (context-aware)");
    expect(result.summary).toContain(
      "Built with limited node context; verify neighboring files manually.",
    );
  });

  it("passes result fields through unchanged and calls formatQuickFileAuditMarkdown", () => {
    mockFormat.mockClear();
    const input = makeAuditResult({ consistency: "mismatch", consistencyNote: "stale diff" });
    const result = toQuickFileAuditPreview(input);

    expect(result.analysisRef).toBe(analysisRef);
    expect(result.confidence).toBe("high");
    expect(result.consistency).toBe("mismatch");
    expect(result.consistencyNote).toBe("stale diff");
    expect(result.path).toBe("src/app.ts");
    expect(result.contextDiagnostics).toEqual(input.contextDiagnostics);
    expect(result.contextMeta).toEqual(input.contextMeta);
    expect(mockFormat).toHaveBeenCalledTimes(1);
    expect(mockFormat).toHaveBeenCalledWith(input);
  });
});

describe("toDocumentFilePreview", () => {
  it("uses documentation as content without context prefix", () => {
    const input = makeDocResult({
      contextDiagnostics: makeContext({ hasContext: false }),
    });
    const result = toDocumentFilePreview(input);

    expect(result.action).toBe("document-file-preview");
    expect(result.content).toBe("# Docs for src/app.ts");
    expect(result.title).toBe("Documentation preview (file-only)");
    expect(result.summary).toBe(
      "Documents the module. Generated without selected-node repository context.",
    );
  });

  it("passes values through and uses graph-backed title", () => {
    const result = toDocumentFilePreview(
      makeDocResult({
        contextDiagnostics: makeContext({ contextStrength: "strong" }),
        contextMeta: makeMeta({ graphBacked: true }),
      }),
    );

    expect(result.title).toBe("Documentation preview (graph-backed)");
    expect(result.confidence).toBe("medium");
    expect(result.consistency).toBe("unknown");
    expect(result.analysisRef).toBe(analysisRef);
    expect(result.contextMeta.graphBacked).toBe(true);
  });
});
