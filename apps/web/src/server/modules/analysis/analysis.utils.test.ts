import type { DocType } from "@doxynix/shared";
import type { Repo } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RepoSearchResult } from "@/server/utils/types";

import type {
  FileActionInput,
  FileActionNodeContext,
  QuickFileAuditResult,
} from "./analysis.schemas";
import {
  buildAuditFallback,
  buildContextPromptGuidance,
  buildContextSection,
  buildDocumentFallback,
  dedupeSearchResults,
  deriveMaintenanceStatus,
  describeContextQualifier,
  formatQuickFileAuditMarkdown,
  getNonActionableReason,
  isBinaryLikeContent,
  isProbablyMinifiedContent,
  pickLatestDocsByType,
  scoreSearchMatch,
} from "./analysis.utils";

// Heavy/IO-bound modules are mocked so the module under test imports cleanly.
// ProjectPolicy stays real: it is pure (picomatch-based path classification).
vi.mock("@/server/utils/call", () => ({ callWithFallback: vi.fn() }));
vi.mock("@/server/utils/optimizers", () => ({
  CodeOptimizer: { cleanForTool: vi.fn(), optimize: vi.fn() },
}));
vi.mock("./ai/ai-constants", () => ({ getActiveModels: vi.fn() }));
vi.mock("./ai/ai-tools", () => ({ buildRepositoryToolProfile: vi.fn() }));
vi.mock("./ai/prompts-refactored", () => ({ buildSingleFileAnalysisPrompt: vi.fn() }));

const MONTH_MS = 1000 * 60 * 60 * 24 * 30;
const NOW = Date.parse("2026-01-15T00:00:00Z");

const Q = {
  graphLight: "Only light graph-backed repository context was available.",
  graphModerate: "Graph-backed repository context was available, but only partially rich.",
  graphStrong: "Strong graph-backed repository context was available.",
  nodeLevel: "Node-level repository context was available, but it was not graph-backed.",
  nodeLight: "Only light node-level repository context was available.",
  none: "No selected-node repository context was available.",
};

function nodeContext(overrides: Partial<FileActionNodeContext> = {}): FileActionNodeContext {
  return {
    confidence: "medium",
    role: "service",
    title: "Billing service",
    whyImportant: "processes payments",
    ...overrides,
  };
}

function searchResult(id: string, label: string, score: number): RepoSearchResult {
  return {
    description: "d",
    docSectionId: null,
    docType: null,
    id,
    kind: "file",
    label,
    nodeId: null,
    path: null,
    score,
    targetView: "code",
  };
}

function repoAt(pushedAtMs: null | number, updatedAtMs = pushedAtMs ?? NOW): Repo {
  return {
    pushedAt: pushedAtMs == null ? null : new Date(pushedAtMs),
    updatedAt: new Date(updatedAtMs),
  } as Repo;
}

/** n pretend paths, e.g. for padding getContextStrength signal counts. */
function paths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i}.ts`);
}

/** count lines of `lineLen` chars joined by newlines, for minification probes. */
function manyLines(lineLen: number, count: number): string {
  return Array.from({ length: count }, () => "a".repeat(lineLen)).join("\n");
}

describe("isBinaryLikeContent", () => {
  it.each([
    ["\\u0000 NUL", "\u0000", true],
    ["\\u0007 bell", "text\u0007more", true],
    ["\\u001A SUB", "a\u001Ab", true],
    ["wildcard bytes", "abc\u0015def", true],
    ["plain text", "const x = 1;", false],
    ["newlines only", "line1\nline2\rline3", false],
    ["tab only", "\t", false],
    ["CRLF text", "a\r\nb", false],
  ])(`%s → %s`, (_name, content, expected) => {
    expect(isBinaryLikeContent(content)).toBe(expected);
  });
});

describe("isProbablyMinifiedContent", () => {
  it.each([
    ["short source", "const x = 1;", false],
    ["2000-char single line", "a".repeat(2000), true],
    ["3000-char single line", "a".repeat(3000), true],
    ["5000-char single line (len > 4000)", "a".repeat(5000), true],
    ["1300-char line, near-zero whitespace", `${"a".repeat(1300)}\n${"a".repeat(701)}`, true],
    ["3000 chars across many newlines", manyLines(10, 300), false],
    ["2399 chars with whitespace and newlines", manyLines(5, 400), false],
    ["empty string", "", false],
  ])(`%s → %s`, (_name, content, expected) => {
    expect(isProbablyMinifiedContent(content)).toBe(expected);
  });
});

describe("scoreSearchMatch", () => {
  it("scores exact > prefix > partial per term", () => {
    const exact = scoreSearchMatch(["auth"], ["auth"]);
    const prefix = scoreSearchMatch(["auth"], ["auth-service"]);
    const partial = scoreSearchMatch(["auth"], ["my-auth-handler"]);
    const none = scoreSearchMatch(["auth"], ["billing"]);

    expect(exact).toBe(12);
    expect(prefix).toBe(8);
    expect(partial).toBe(4);
    expect(none).toBe(0);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(none);
  });

  it("accumulates points across multiple matching terms", () => {
    // "auth" matches by prefix (8), "server" matches by substring (4).
    expect(scoreSearchMatch(["auth", "server"], ["auth-server"])).toBe(12);
    expect(scoreSearchMatch(["auth", "server"], ["billing"])).toBe(0);
  });

  it("returns 0 for no terms, no usable values, or case-mismatched terms", () => {
    expect(scoreSearchMatch([], ["auth"])).toBe(0);
    expect(scoreSearchMatch(["auth"], [null, undefined, ""])).toBe(0);
    // values are lowercased, terms are not — case must match the term casing.
    expect(scoreSearchMatch(["Auth"], ["auth"])).toBe(0);
  });
});

describe("dedupeSearchResults", () => {
  it("keeps the highest-scoring entry per id", () => {
    const results = [
      searchResult("r1", "zeta", 10),
      searchResult("r2", "alpha", 10),
      searchResult("r1", "zeta-old", 3),
      searchResult("r3", "beta", 1),
    ];

    expect(dedupeSearchResults(results)).toEqual([
      searchResult("r2", "alpha", 10),
      searchResult("r1", "zeta", 10),
      searchResult("r3", "beta", 1),
    ]);
  });

  it("sorts equal scores by label ascending and returns [] for empty input", () => {
    const results = [searchResult("x", "zebra", 8), searchResult("y", "apple", 8)];
    expect(dedupeSearchResults(results).map((r) => r.label)).toEqual(["apple", "zebra"]);
    expect(dedupeSearchResults([])).toEqual([]);
  });
});

describe("pickLatestDocsByType", () => {
  const docs = (): Array<{ type: DocType; updatedAt: Date }> => [
    { type: "API", updatedAt: new Date("2024-01-01") },
    { type: "API", updatedAt: new Date("2025-06-01") },
    { type: "README", updatedAt: new Date("2023-01-01") },
    { type: "README", updatedAt: new Date("2022-01-01") },
  ];

  it("keeps the latest doc per type and orders types ascending", () => {
    expect(pickLatestDocsByType(docs()).map((d) => [d.type, d.updatedAt.toISOString()])).toEqual([
      ["API", "2025-06-01T00:00:00.000Z"],
      ["README", "2023-01-01T00:00:00.000Z"],
    ]);
  });

  it("returns [] for empty input", () => {
    expect(pickLatestDocsByType([])).toEqual([]);
  });
});

describe("deriveMaintenanceStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["13 months old", NOW - 13 * MONTH_MS, "dead"],
    ["exactly 12 months old", NOW - 12 * MONTH_MS, "stale"],
    ["7 months old", NOW - 7 * MONTH_MS, "stale"],
    ["exactly 6 months old", NOW - 6 * MONTH_MS, "active"],
    ["1 month old", NOW - MONTH_MS, "active"],
    ["future pushedAt", NOW + MONTH_MS, "active"],
  ])(`%s → %s`, (_name, pushedAtMs, expected) => {
    expect(deriveMaintenanceStatus(repoAt(pushedAtMs))).toBe(expected);
  });

  it("falls back to updatedAt when pushedAt is null", () => {
    expect(deriveMaintenanceStatus(repoAt(null, NOW - 13 * MONTH_MS))).toBe("dead");
    expect(deriveMaintenanceStatus(repoAt(null, NOW - MONTH_MS))).toBe("active");
  });
});

describe("describeContextQualifier", () => {
  it.each([
    ["no context", undefined, Q.none],
    ["light, node-level", nodeContext({ sourcePaths: ["a.ts"] }), Q.nodeLight],
    ["moderate, node-level", nodeContext({ sourcePaths: paths(7) }), Q.nodeLevel],
    [
      "strong, graph-backed",
      nodeContext({ graphNeighbors: ["g"], sourcePaths: paths(11) }),
      Q.graphStrong,
    ],
    [
      "moderate, graph-backed",
      nodeContext({ graphNeighbors: ["g"], sourcePaths: paths(6) }),
      Q.graphModerate,
    ],
    ["light, graph-backed", nodeContext({ graphNeighbors: ["g"] }), Q.graphLight],
  ])(`%s → %s`, (_name, ctx, expected) => {
    expect(describeContextQualifier(ctx)).toBe(expected);
  });
});

describe("buildContextPromptGuidance", () => {
  it("returns the no-context guidance verbatim", () => {
    const guidance = buildContextPromptGuidance(undefined);
    expect(guidance).toContain("No repository node context is available.");
    expect(guidance).toContain('set exactly to a literal string value: "high", "medium", or "low"');
  });

  it.each([
    [
      "strong, graph-backed",
      nodeContext({ graphNeighbors: ["g", "g2"], sourcePaths: paths(10) }),
      "Strong graph-backed repository context is available.",
    ],
    [
      "moderate, graph-backed",
      nodeContext({ graphNeighbors: ["g"], sourcePaths: paths(6) }),
      "Moderate graph-backed repository context is available.",
    ],
    [
      "light, graph-backed",
      nodeContext({ graphNeighbors: ["g"] }),
      "Only light graph-backed context is available.",
    ],
    [
      "moderate, node-level",
      nodeContext({ sourcePaths: paths(7) }),
      "Node-level repository context is available, but it is not graph-backed.",
    ],
    [
      "light, node-level",
      nodeContext({ sourcePaths: ["a.ts"] }),
      "Only light node-level repository context is available.",
    ],
  ])(`%s → %s`, (_name, ctx, expected) => {
    expect(buildContextPromptGuidance(ctx)).toContain(expected);
  });
});

describe("buildContextSection", () => {
  const fullContext = nodeContext({
    confidence: "high",
    graphNeighbors: ["g1", "g2"],
    neighborBuckets: { empty: [], imports: ["a/b.ts"] },
    neighborPaths: ["a/c.ts"],
    nextSuggestedPaths: ["a/d.ts"],
    recommendedActions: ["extract helper"],
    reviewPriority: { level: "high", reason: "hot path" },
    sourcePaths: ["a/b.ts"],
    summary: ["handles", "billing"],
  });

  it("renders an empty string when there is no node context or context block", () => {
    const input: FileActionInput = {
      branch: "main",
      content: "code",
      language: "ts",
      path: "src/a.ts",
      repoId: "r1",
    };
    expect(buildContextSection(input)).toBe("");
    expect(buildContextSection({ ...input, contextBlock: "   " })).toBe("");
  });

  it("renders every labeled section with data present", () => {
    const input: FileActionInput = {
      branch: "main",
      content: "code",
      contextBlock: "context data",
      language: "ts",
      nodeContext: fullContext,
      path: "src/billing.ts",
      repoId: "r1",
    };

    const section = buildContextSection(input);
    const expectedLabels = [
      "<repository_context>",
      "</repository_context>",
      "Node title: Billing service",
      "Node role: service",
      "Node confidence: high",
      "Why important: processes payments",
      "Review priority: high - hot path",
      "Recommended actions: extract helper",
      "Next suggested paths: a/d.ts",
      "Neighbor paths: a/c.ts",
      "Graph neighbors: g1, g2",
      "Source paths: a/b.ts",
      "imports: a/b.ts",
      "Node summary: handles billing",
      "[Context Block]\ncontext data",
    ];
    for (const label of expectedLabels) {
      expect(section).toContain(label);
    }
    expect(section).not.toContain("empty:");
  });
});

describe("getNonActionableReason", () => {
  it.each([
    [".env", "anything", "The file looks sensitive"],
    ["src/assets/logo.svg", "anything", "asset, vendored dependency, or build artifact"],
    ["node_modules/a/index.js", "anything", "asset, vendored dependency, or build artifact"],
    ["src/generated/types.ts", "anything", "The file looks generated"],
    ["package-lock.json", "anything", "low-signal lock or build metadata"],
  ])(`%s → message contains %s`, (path, content, expected) => {
    expect(getNonActionableReason(path, content)).toContain(expected);
  });

  it("flags minified content only when the path is otherwise actionable", () => {
    expect(getNonActionableReason("src/index.ts", "a".repeat(3000))).toContain(
      "minified or machine-packed",
    );
  });

  it("returns null for an actionable file and appends the context qualifier otherwise", () => {
    expect(getNonActionableReason("src/index.ts", "const x = 1;")).toBeNull();
    const withContext = getNonActionableReason(".env", "x", nodeContext({ sourcePaths: ["a.ts"] }));
    expect(withContext).toContain(Q.nodeLight);
  });
});

describe("fallback builders and markdown", () => {
  it("buildAuditFallback returns a low-confidence empty result", () => {
    expect(buildAuditFallback("src/a.ts", "no evidence")).toEqual<QuickFileAuditResult>({
      confidence: "low",
      issues: [],
      path: "src/a.ts",
      strengths: [],
      suggestions: [],
      summary: "no evidence",
    });
  });

  it("buildDocumentFallback returns a low-confidence empty doc preview", () => {
    expect(buildDocumentFallback("src/a.ts", "outline")).toEqual({
      confidence: "low",
      documentation: "outline",
      edits: [],
      path: "src/a.ts",
      summary: "outline",
    });
  });

  it("formatQuickFileAuditMarkdown renders sections only when non-empty", () => {
    const minimal: QuickFileAuditResult = {
      confidence: "low",
      issues: [],
      path: "src/a.ts",
      strengths: [],
      suggestions: [],
      summary: "short summary",
    };
    expect(formatQuickFileAuditMarkdown(minimal)).toBe(
      "# Quick File Audit\n**Path:** `src/a.ts`\n**Confidence:** low\n\nshort summary",
    );
    const full: QuickFileAuditResult = {
      ...minimal,
      confidence: "high",
      issues: ["memory leak"],
      strengths: ["uses hooks"],
      suggestions: ["add cleanup"],
      summary: "summary",
    };
    const markdown = formatQuickFileAuditMarkdown(full);
    expect(markdown).toContain("## Strengths\n- uses hooks");
    expect(markdown).toContain("## Issues\n- memory leak");
    expect(markdown).toContain("## Suggestions\n- add cleanup");
  });
});
