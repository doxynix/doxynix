import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks – one canonical source of truth for every external dep.
// Duplicated per test file: the service imports ALL of these at module load,
// so they must be mocked in every file that imports ./analysis.service.
// ---------------------------------------------------------------------------
const m = vi.hoisted(() => ({
  // analysisContext — returns a builder with stub methods
  analysisContext: {
    build: vi.fn(),
    getDiagnostics: vi.fn(() => ({})),
    getMeta: vi.fn(() => ({})),
  },
  analysisMapper: {
    buildAffectedNodes: vi.fn(() => []),
    buildAffectedZones: vi.fn(() => []),
    buildTopFindings: vi.fn(async () => []),
    countFindingsByFile: vi.fn(() => new Map()),
    matchTopLevelZone: vi.fn(() => null),
    parseChangedFilesSnapshot: vi.fn(() => []),
    parsePersistedFindings: vi.fn(() => []),
    resolveMatchedNode: vi.fn(() => null),
    selectPrimaryFile: vi.fn(() => null),
    toAvailableDocs: vi.fn(() => []),
    toBriefPanelInput: vi.fn(() => ({})),
    toDetailedMetrics: vi.fn(() => ({ score: 80 })),
    toInteractiveBriefNodePayloadInput: vi.fn(() => ({})),
    toOverview: vi.fn(() => null),
  },
  // analysisRepo — every method the service calls
  analysisRepo: {
    create: vi.fn(),
    getLatestRef: vi.fn(),
    getRepoBySha: vi.fn(),
    getRepoSnapshot: vi.fn(),
    getRepoSnapshotForFix: vi.fn(),
    loadImpactAnalysis: vi.fn(),
    loadLatestDocumentsWithContent: vi.fn(),
    loadRelatedFixes: vi.fn(),
    loadRelatedPrFindings: vi.fn(),
    updateStatus: vi.fn(),
  },
  // Logging
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  // FixService (exported by ./logic/fix-generator)
  applyFix: vi.fn(async () => ({ prNumber: 42, prUrl: "https://pr" })),
  // Call-with-fallback (AI orchestration)
  callWithFallback: vi.fn(),
  // CodeOptimizer (used by runDocumentFilePreview)
  cleanForTool: vi.fn(async (c: string) => c),
  // createAnalyzeContextBuilder (exported by ./logic/analyze-context-builder)
  createAnalyzeContextBuilder: vi.fn(() => ({
    getEntityContext: vi.fn(() => ({ structureContext: null })),
    getNodeExplain: vi.fn(() => null),
    getStructureContext: vi.fn(() => null),
    getStructureMap: vi.fn(() => null),
    getStructureNode: vi.fn(() => null),
  })),
  // Prisma DB client (used by getHistory, getDocumentContent, autoSyncDocsToGithub)
  db: {
    analysis: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    document: { findFirst: vi.fn() },
    githubInstallation: { findFirst: vi.fn() },
    repo: { findFirst: vi.fn() },
  },
  // generateBranchName (used by autoSyncDocsToGithub)
  generateBranchName: vi.fn(() => "doxynix/doc-sync-abc123"),
  // AI models
  getActiveModels: vi.fn(async () => ({
    WRITER: [{ modelId: "test-model", provider: "test" }],
  })),
  // GitHub provider
  getInstallationClient: vi.fn(() => ({
    repos: {
      createOrUpdateFileContents: vi.fn(),
      createPullRequest: vi.fn(),
      get: vi.fn(),
    },
  })),
  // Code highlight
  highlightCode: vi.fn(async () => "<code>highlighted</code>"),
  // Markdown → HTML
  markdownToHtml: vi.fn(async (p: { content: string }) => `<p>${p.content}</p>`),
  // Search utils (pure aliases with real behavior)
  normalizeSearchInput: vi.fn((s: string) => (s.trim() === "" ? null : s.trim())),
  // Realtime
  realtimeService: {
    user: vi.fn(() => ({ publish: vi.fn() })),
  },
  // Trigger.dev tasks
  tasks: { trigger: vi.fn() },
  tokenizeSearchInput: vi.fn((s: string) => s.toLowerCase().split(/\s+/).filter(Boolean)),
  // Next.js unstable_cache
  unstableCache: vi.fn((_fn: unknown, _keys: unknown, _opts: unknown) => {
    // Return a function that simply calls the wrapped function (no caching)
    return async (...args: unknown[]) => (_fn as (...a: unknown[]) => unknown)(...args);
  }),
}));

// ---------------------------------------------------------------------------
// vi.mock — map import specifiers to hoisted references
// ---------------------------------------------------------------------------
vi.mock("./analysis.repository", () => ({ analysisRepo: m.analysisRepo }));
vi.mock("./analysis.context", () => ({
  analysisContext: m.analysisContext,
}));
vi.mock("./logic/analyze-context-builder", () => ({
  createAnalyzeContextBuilder: m.createAnalyzeContextBuilder,
}));
vi.mock("./logic/fix-generator", () => ({
  FixService: class {
    applyFix = m.applyFix;
  },
}));
vi.mock("./analysis.mapper", () => ({ analysisMapper: m.analysisMapper }));
vi.mock("./ai/ai-constants", () => ({ getActiveModels: m.getActiveModels }));
vi.mock("@/server/core/github/github-provider", () => ({
  getInstallationClient: m.getInstallationClient,
}));
vi.mock("@/server/core/realtime", () => ({ realtimeService: m.realtimeService }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: m.appLogger }));
vi.mock("@/server/core/db", () => ({ PrismaClient: vi.fn(), prisma: m.db }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: m.tasks }));
vi.mock("@/shared/lib/shiki", () => ({ highlightCode: m.highlightCode }));
vi.mock("@/shared/lib/get-branch-name", () => ({
  generateBranchName: m.generateBranchName,
}));
vi.mock("@/server/utils/markdown-to-html", () => ({
  markdownToHtml: m.markdownToHtml,
}));
vi.mock("@/server/utils/call", () => ({ callWithFallback: m.callWithFallback }));
vi.mock("@/server/utils/optimizers", () => ({
  CodeOptimizer: { cleanForTool: m.cleanForTool },
}));
vi.mock("@/server/utils/search", () => ({
  normalizeSearchInput: m.normalizeSearchInput,
  tokenizeSearchInput: m.tokenizeSearchInput,
}));
vi.mock("next/cache", () => ({ unstable_cache: m.unstableCache }));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------
import { repoAnalysisService } from "./analysis.service";

beforeEach(() => {
  vi.clearAllMocks();

  // Default implementations that most tests rely on
  m.normalizeSearchInput.mockImplementation((s: string) => (s.trim() === "" ? null : s.trim()));
  m.tokenizeSearchInput.mockImplementation((s: string) =>
    s.toLowerCase().split(/\s+/).filter(Boolean),
  );
  m.analysisContext.build.mockResolvedValue({
    getStructureMap: vi.fn(() => null),
    getStructureNode: vi.fn(() => null),
  });
  m.analysisRepo.getLatestRef.mockResolvedValue(null);
  m.analysisContext.getDiagnostics.mockReturnValue({});
  m.analysisContext.getMeta.mockReturnValue({});
});

// =========================================================================
// Layer A — runDocumentFilePreview: surgical-edit pipeline
// (exercises the internal applyDocumentSurgicalEdit / adjustDocumentIndentation
//  logic through the public entry point)
// =========================================================================
describe("runDocumentFilePreview — surgical-edit pipeline", () => {
  const baseInput = {
    branch: "main",
    content: "",
    language: "ts",
    path: "src/mod.ts",
    repoId: "repo-1",
  };

  function callWith(content: string, edits: Array<{ replace: string; search: string }>) {
    m.callWithFallback.mockResolvedValue({
      confidence: "high",
      edits,
      summary: "Test summary",
    });
    return repoAnalysisService.runDocumentFilePreview(1, { ...baseInput, content });
  }

  it("returns early for empty content", async () => {
    const result = await repoAnalysisService.runDocumentFilePreview(1, {
      ...baseInput,
      content: "",
    });
    expect(result).toBeDefined();
    expect(m.callWithFallback).not.toHaveBeenCalled();
  });

  it("returns early for binary-like content", async () => {
    const result = await repoAnalysisService.runDocumentFilePreview(1, {
      ...baseInput,
      content: "\x00\x01\x02\x03\x04\x05",
    });
    expect(result).toBeDefined();
    expect(m.callWithFallback).not.toHaveBeenCalled();
  });

  it("applies exact-match surgical edit", async () => {
    const original = "function foo() {\n  return 42;\n}\n";
    const search = "function foo() {\n  return 42;\n}";
    const replace = "/** Calculates answer. */\nfunction foo() {\n  return 42;\n}";
    const result = await callWith(original, [{ replace, search }]);
    expect(result.documentation).toContain("/** Calculates answer. */");
    expect(result.documentation).toContain("return 42;");
  });

  it("applies fuzzy-match surgical edit (trim-based matching)", async () => {
    const original = ["function greet() {", "  const name = 'world';", "  return name;", "}"].join(
      "\n",
    );
    // Fuzzy: first line differs by content, but remains similar enough (jaccard > 0.75)
    const search = ["function greet(name: string) {", "  return name;", "}"].join("\n");
    const replace = ["/** Greet. */", "function greet(name: string) {", "  return name;", "}"].join(
      "\n",
    );
    const result = await callWith(original, [{ replace, search }]);
    expect(typeof result.documentation).toBe("string");
  });

  it("normalizes CRLF in search/replace before matching", async () => {
    const original = "line1\r\nline2\r\nline3";
    const search = "line1\r\nline2";
    const replace = "line1\r\nline2\r\n// patched";
    const result = await callWith(original, [{ replace, search }]);
    expect(result.documentation).toContain("line1");
  });

  it("returns original content when no match found", async () => {
    const original = "const x = 1;\nconst y = 2;\n";
    const search = "does not exist anywhere";
    const replace = "replaced!";
    const result = await callWith(original, [{ replace, search }]);
    expect(result.documentation).toBe(original);
  });

  it("applies multiple edits sequentially", async () => {
    const original = "AAA\nBBB\nCCC\n";
    const result = await callWith(original, [
      { replace: "AAA-replaced", search: "AAA" },
      { replace: "CCC-replaced", search: "CCC" },
    ]);
    expect(result.documentation).toContain("AAA-replaced");
    expect(result.documentation).toContain("CCC-replaced");
  });

  it("passes empty edits through unchanged", async () => {
    const result = await callWith("const a = 1;\n", []);
    expect(result.documentation).toBe("const a = 1;\n");
  });
});

// =========================================================================
// Layer B — highlightFile (thin wrapper around shiki)
// =========================================================================
describe("highlightFile", () => {
  it("extracts extension and delegates to highlightCode", async () => {
    const result = await repoAnalysisService.highlightFile("console.log('hi')", "src/app.ts");
    expect(m.highlightCode).toHaveBeenCalledWith("console.log('hi')", "ts");
    expect(result).toEqual({ html: "<code>highlighted</code>" });
  });

  it("defaults to txt extension when no extension present", async () => {
    await repoAnalysisService.highlightFile("hello", "Makefile");
    expect(m.highlightCode).toHaveBeenCalledWith("hello", "txt");
  });

  it("lowercases extension", async () => {
    await repoAnalysisService.highlightFile("code", "File.TSX");
    expect(m.highlightCode).toHaveBeenCalledWith("code", "tsx");
  });
});
