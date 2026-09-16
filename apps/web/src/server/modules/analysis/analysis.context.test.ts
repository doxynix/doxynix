import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getNodeExplain: vi.fn(),
  getRepoSnapshot: vi.fn(),
}));

vi.mock("./analysis.repository", () => ({
  analysisRepo: { getRepoSnapshot: mocks.getRepoSnapshot },
}));

vi.mock("./logic/analyze-context-builder", () => ({
  createAnalyzeContextBuilder: vi.fn(() => ({ getNodeExplain: mocks.getNodeExplain })),
}));

import { analysisContext } from "./analysis.context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const db = {} as never;

function makeExplainFixture() {
  return {
    confidence: "high" as const,
    nextSuggestedPaths: ["src/b.ts", "src/c.ts"],
    node: { id: "node-x", label: "Module X" },
    relationships: {
      neighborBuckets: {
        callers: ["src/caller.ts"],
        graphNeighbors: ["node-y", "node-z"],
        imports: ["src/imported.ts"],
      },
      neighborPaths: ["src/neighbor.ts"],
      recommendedActions: ["Add tests"],
      reviewPriority: { level: "medium" as const, reason: "Moderate complexity" },
    },
    role: "service",
    sourcePaths: ["src/x.ts"],
    summary: ["Handles business logic"],
    whyImportant: "Core service module",
  };
}

function expectedNodeContextFrom(explain: ReturnType<typeof makeExplainFixture>) {
  return {
    confidence: explain.confidence,
    graphNeighbors: explain.relationships.neighborBuckets.graphNeighbors,
    neighborBuckets: explain.relationships.neighborBuckets,
    neighborPaths: explain.relationships.neighborPaths,
    nextSuggestedPaths: explain.nextSuggestedPaths,
    nodeId: explain.node.id,
    recommendedActions: explain.relationships.recommendedActions,
    reviewPriority: explain.relationships.reviewPriority,
    role: explain.role,
    sourcePaths: explain.sourcePaths,
    summary: explain.summary,
    title: explain.node.label,
    whyImportant: explain.whyImportant,
  };
}

// ---------------------------------------------------------------------------
// analysisContext.build
// ---------------------------------------------------------------------------
describe("analysisContext.build", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when nodeId is null", async () => {
    const result = await analysisContext.build(db, "repo-1", undefined);
    expect(result).toBeNull();
    expect(mocks.getRepoSnapshot).not.toHaveBeenCalled();
  });

  it("returns null when getRepoSnapshot resolves null", async () => {
    mocks.getRepoSnapshot.mockResolvedValue(null);

    const result = await analysisContext.build(db, "repo-1", "node-x");
    expect(result).toBeNull();
    expect(mocks.getRepoSnapshot).toHaveBeenCalledWith(db, "repo-1");
  });

  it("returns null when getNodeExplain resolves null", async () => {
    const snapshot = { id: "repo-1" };
    mocks.getRepoSnapshot.mockResolvedValue(snapshot);
    mocks.getNodeExplain.mockReturnValue(null);

    const result = await analysisContext.build(db, "repo-1", "node-x");
    expect(result).toBeNull();
    expect(mocks.getNodeExplain).toHaveBeenCalledWith("node-x");
  });

  it("returns mapped NodeContext on happy path", async () => {
    const explain = makeExplainFixture();
    const snapshot = { id: "repo-1" };
    mocks.getRepoSnapshot.mockResolvedValue(snapshot);
    mocks.getNodeExplain.mockReturnValue(explain);

    const result = await analysisContext.build(db, "repo-1", "node-x");

    expect(result).toEqual(expectedNodeContextFrom(explain));
    expect(mocks.getRepoSnapshot).toHaveBeenCalledWith(db, "repo-1");
    expect(mocks.getNodeExplain).toHaveBeenCalledWith("node-x");
  });
});

// ---------------------------------------------------------------------------
// analysisContext.getDiagnostics
// ---------------------------------------------------------------------------
describe("analysisContext.getDiagnostics", () => {
  it("returns 'none' diagnostics for null context", () => {
    expect(analysisContext.getDiagnostics(null)).toEqual({
      contextStrength: "none",
      graphNeighborCount: 0,
      hasContext: false,
      neighborPathCount: 0,
      nextSuggestedPathCount: 0,
      nonEmptyBuckets: [],
      recommendedActionCount: 0,
      sourcePathCount: 0,
    });
  });

  it("computes 'light' strength for sparse signals", () => {
    const ctx = {
      confidence: "low" as const,
      graphNeighbors: ["n1"],
      neighborBuckets: { imports: ["a.ts"] },
      neighborPaths: [],
      nextSuggestedPaths: [],
      nodeId: "x",
      recommendedActions: [],
      reviewPriority: null,
      role: "util",
      sourcePaths: [],
      summary: [],
      title: "X",
      whyImportant: "Because",
    } as Parameters<typeof analysisContext.getDiagnostics>[0];

    const diag = analysisContext.getDiagnostics(ctx);
    expect(diag.contextStrength).toBe("light");
    expect(diag.graphNeighborCount).toBe(1);
    expect(diag.hasContext).toBe(true);
    expect(diag.nonEmptyBuckets).toEqual(["imports"]);
  });

  it("computes 'strong' strength for many signals", () => {
    const ctx = {
      confidence: "high" as const,
      graphNeighbors: ["n1", "n2", "n3"],
      neighborBuckets: { callers: ["c1"], imports: ["i1", "i2"] },
      neighborPaths: ["p1", "p2", "p3"],
      nextSuggestedPaths: ["s1", "s2"],
      nodeId: "x",
      recommendedActions: ["r1", "r2"],
      reviewPriority: null,
      role: "service",
      sourcePaths: ["src1", "src2", "src3"],
      summary: [],
      title: "X",
      whyImportant: "Because",
    } as Parameters<typeof analysisContext.getDiagnostics>[0];

    const diag = analysisContext.getDiagnostics(ctx);
    // 3 source + 3 graph + 3 neighbor + 2 next + 2 recommended + 2 buckets = 15
    expect(diag.contextStrength).toBe("strong");
  });
});

// ---------------------------------------------------------------------------
// analysisContext.getMeta
// ---------------------------------------------------------------------------
describe("analysisContext.getMeta", () => {
  it("returns default meta for null context", () => {
    expect(analysisContext.getMeta(null)).toEqual({
      confidence: null,
      graphBacked: false,
      mode: "none",
      nodeId: null,
      source: "none",
      title: null,
    });
  });

  it("returns populated meta for a valid context", () => {
    const ctx = {
      confidence: "medium" as const,
      graphNeighbors: ["n1"],
      neighborBuckets: {},
      neighborPaths: [],
      nextSuggestedPaths: [],
      nodeId: "node-42",
      recommendedActions: [],
      reviewPriority: null,
      role: "component",
      sourcePaths: [],
      summary: [],
      title: "MyComponent",
      whyImportant: "Important",
    } as Parameters<typeof analysisContext.getMeta>[0];

    const meta = analysisContext.getMeta(ctx);
    expect(meta).toEqual({
      confidence: "medium",
      graphBacked: true,
      mode: "node",
      nodeId: "node-42",
      source: "node-explain",
      title: "MyComponent",
    });
  });

  it("sets graphBacked to false when graphNeighbors is empty", () => {
    const ctx = {
      confidence: "high" as const,
      graphNeighbors: [],
      neighborBuckets: {},
      neighborPaths: [],
      nextSuggestedPaths: [],
      nodeId: "node-1",
      recommendedActions: [],
      reviewPriority: null,
      role: "util",
      sourcePaths: [],
      summary: [],
      title: "U",
      whyImportant: "Because",
    } as Parameters<typeof analysisContext.getMeta>[0];

    expect(analysisContext.getMeta(ctx).graphBacked).toBe(false);
  });
});
