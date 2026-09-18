// secretlint-disable

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/app-logger", () => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/server/utils/call", () => ({ callWithFallback: vi.fn() }));

vi.mock("../ai/ai-constants", () => ({
  getActiveModels: vi.fn(async () => ({ FAST: ["fast-model"], POWERFUL: ["powerful-model"] })),
}));

vi.mock("../ai/ai-tools", () => ({ buildRepositoryToolProfile: vi.fn(() => ({})) }));

vi.mock("../ai/prompts-refactored", () => ({
  buildPrReviewSystemPrompt: vi.fn(() => "system-prompt"),
  buildPrReviewUserPrompt: vi.fn(() => "user-prompt"),
}));

vi.mock("../analysis.schemas", () => ({ PrAiReviewOutputSchema: {} }));

import { appLogger } from "@/server/core/app-logger";
import { callWithFallback } from "@/server/utils/call";

import { DifferentialAnalyzer } from "./differential-analyzer";
import type { PRAnalysisConfig } from "./pr.types";

const SECRET_PATCH = `--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,0 +11,4 @@
+const stripe = "sk_live_aaaaaaaaaaaaaaaaaaaaaaaa";
+const node = eval("1 + 1");
+db.execute("SELECT * FROM users");
+// TODO: replace
`;

const RATIO_PATCH = `--- a/src/refactor.ts
+++ b/src/refactor.ts
@@ -1,0 +1,3 @@
+first
+second
+third
`;

const makeConfig = (overrides: Partial<PRAnalysisConfig> = {}): PRAnalysisConfig => ({
  ciSkip: false,
  commentStyle: "DETAILED",
  enabled: true,
  excludePatterns: [],
  focusAreas: [],
  tokenBudget: 40_000,
  ...overrides,
});

const makeDiffInfo = (
  changedFiles: Array<{
    additions?: number;
    deletions?: number;
    filename: string;
    patch?: string;
  }>,
): Parameters<DifferentialAnalyzer["analyzePRDiff"]>[0] => ({
  baseSha: "base-sha",
  changedFiles: changedFiles.map((file) => ({ additions: 0, deletions: 0, ...file })),
  headSha: "head-sha",
  owner: "acme",
  prNumber: 42,
  repoName: "demo",
});

const PR_METADATA = { branch: "main", repoId: "repo-1", userId: 7 };

describe("DifferentialAnalyzer.analyzePRDiff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callWithFallback).mockResolvedValue({ findings: [], summary: "" });
  });

  it("returns an empty result when no relevant files are present", async () => {
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 2000, deletions: 0, filename: "src/big.ts" }]),
      "{}",
      PR_METADATA,
    );

    expect(result).toMatchObject({
      analyzedLines: 0,
      changedFiles: 0,
      findings: [],
      riskScore: 0,
      summary: "",
    });
    expect(callWithFallback).not.toHaveBeenCalled();
    expect(appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_no_relevant_files", prNumber: 42 }),
    );
  });

  it("filters files by excludePatterns and a >1000-line limit", async () => {
    const analyzer = new DifferentialAnalyzer(
      makeConfig({ excludePatterns: ["**/node_modules/**"] }),
    );

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([
        { additions: 10, deletions: 2, filename: "src/keep.ts" },
        { additions: 1, deletions: 0, filename: "node_modules/pkg/x.ts", patch: SECRET_PATCH },
        { additions: 1500, deletions: 0, filename: "src/big.ts" },
      ]),
      "{}",
      PR_METADATA,
    );

    expect(result.changedFiles).toBe(1);
    expect(result.analyzedLines).toBe(12);
    expect(result.findings).toEqual([]);
  });

  it("sentinel phase finds secrets, vulnerabilities, SQL and TODOs with correct line numbers", async () => {
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "src/auth.ts",
          line: 11,
          score: 10,
          severity: "CRITICAL",
          title: "Stripe Live Key",
          type: "SECURITY",
        }),
        expect.objectContaining({
          line: 12,
          score: 8,
          severity: "HIGH",
          title: "Dynamic Code Execution (eval)",
        }),
        expect.objectContaining({
          line: 12,
          score: 8,
          severity: "HIGH",
          title: "PHP Code/Command Injection",
        }),
        expect.objectContaining({
          line: 13,
          score: 9,
          severity: "HIGH",
          title: "Raw SQL Execution",
        }),
        expect.objectContaining({
          line: 14,
          score: 2,
          severity: "LOW",
          title: "TODO/FIXME marker found",
          type: "STYLE",
        }),
      ]),
    );
    expect(result.findings).toHaveLength(5);
    expect(result.riskScore).toBe(8); // ceil(mean(10, 8, 8, 9, 2) = 7.4)
    expect(result.analyzedLines).toBe(4);
  });

  it("mapper phase detects high change density (ratio > 2)", async () => {
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([
        { additions: 1, deletions: 0, filename: "src/refactor.ts", patch: RATIO_PATCH },
      ]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        file: "src/refactor.ts",
        line: 1,
        message: "File contains 4 new lines. High density of changes makes review difficult.",
        score: 5,
        severity: "MEDIUM",
        suggestion: "Split the changes into several smaller logical modules or PRs.",
        title: "High change complexity",
        type: "PERFORMANCE",
      }),
    ]);
    expect(result.riskScore).toBe(5);
  });

  it("mapper phase triggers at more than 300 added lines", async () => {
    const bigPatch = `--- a/src/huge.ts
+++ b/src/huge.ts
@@ -0,0 +1,301 @@
${"+a\n".repeat(301)}`;
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 301, deletions: 0, filename: "src/huge.ts", patch: bigPatch }]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      file: "src/huge.ts",
      line: 1,
      score: 5,
      type: "PERFORMANCE",
    });
  });

  it("applyFocusFilters keeps only the specified focusAreas", async () => {
    vi.mocked(callWithFallback).mockResolvedValue({
      findings: [
        { file: "src/api.ts", line: 1, message: "AI bug", score: 6, title: "AI bug", type: "BUG" },
      ],
      summary: "",
    });
    const analyzer = new DifferentialAnalyzer(makeConfig({ focusAreas: ["SECURITY"] }));

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toHaveLength(4); // TODO(STYLE) and AI BUG dropped
    expect(result.findings.every((f) => f.type === "SECURITY")).toBe(true);
  });

  it("deduplicates matching file:line:type:message findings", async () => {
    vi.mocked(callWithFallback).mockResolvedValue({
      findings: [
        {
          // secretlint-disable-next-line
          codeSnippet: 'const stripe = "sk_live_aaaaaaaaaaaaaaaaaaaaaaaa";',
          file: "src/auth.ts",
          line: 11,
          message: "Stripe Live Key",
          score: 10,
          suggestion: "use env",
          title: "Stripe Live Key",
          type: "SECURITY",
        },
      ],
      summary: "mocked summary",
    });
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    // AI duplicate of Stripe dropped; 5 sentinel findings remain.
    expect(result.findings).toHaveLength(5);
    expect(result.summary).toBe("mocked summary");
  });

  it("AI phase maps severity by CRITICAL/HIGH/MEDIUM/LOW thresholds", async () => {
    vi.mocked(callWithFallback).mockResolvedValue({
      findings: [
        { file: "src/a.ts", line: 1, message: "c", score: 10, title: "A", type: "SECURITY" },
        { file: "src/a.ts", line: 2, message: "b", score: 7, title: "B", type: "ARCHITECTURE" },
        { file: "src/a.ts", line: 3, message: "d", score: 4, title: "C", type: "COMPLEXITY" },
        { file: "src/a.ts", line: 4, message: "e", score: 2, title: "D", type: "STYLE" },
      ],
      summary: "",
    });
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "src/a.ts", line: 1, score: 10, severity: "CRITICAL" }),
        expect.objectContaining({ file: "src/a.ts", line: 2, score: 7, severity: "HIGH" }),
        expect.objectContaining({ file: "src/a.ts", line: 3, score: 4, severity: "MEDIUM" }),
        expect.objectContaining({ file: "src/a.ts", line: 4, score: 2, severity: "LOW" }),
      ]),
    );
  });

  it("full pipeline: sentinel + mapper + AI findings are merged and scored", async () => {
    vi.mocked(callWithFallback).mockResolvedValue({
      findings: [
        {
          file: "src/lib.ts",
          line: 9,
          message: "races",
          score: 7,
          title: "Race",
          type: "COMPLEXITY",
        },
      ],
      summary: "PR summary",
    });
    const analyzer = new DifferentialAnalyzer(
      makeConfig({ excludePatterns: ["**/node_modules/**"] }),
    );

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([
        { additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH },
        { additions: 1, deletions: 0, filename: "src/refactor.ts", patch: RATIO_PATCH },
        { additions: 1, deletions: 0, filename: "node_modules/pkg/a.ts", patch: SECRET_PATCH },
        { additions: 1500, deletions: 0, filename: "src/big.ts" },
      ]),
      "{}",
      PR_METADATA,
    );

    expect(result.changedFiles).toBe(2);
    expect(result.analyzedLines).toBe(5);
    expect(result.findings).toHaveLength(7); // 5 sentinel (incl. PHP Code/Command Injection) + 1 mapper + 1 AI
    expect(result.summary).toBe("PR summary");
    expect(result.riskScore).toBe(7); // ceil(mean(10, 8, 8, 9, 2, 5, 7) = 7)
  });

  it("AI phase failure → warn and fallback to local analysis", async () => {
    vi.mocked(callWithFallback).mockRejectedValue(new Error("model exploded"));
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    expect(result.findings).toHaveLength(5);
    expect(result.summary).toBe("");
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "AI Diff Review failed, falling back to local static analysis only",
        prNumber: 42,
      }),
    );
  });

  it("does not call AI when no patch data is present", async () => {
    const analyzer = new DifferentialAnalyzer(makeConfig());

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 2, deletions: 1, filename: "src/no-patch.ts" }]),
      "{}",
      PR_METADATA,
    );

    expect(callWithFallback).not.toHaveBeenCalled();
    expect(result.findings).toEqual([]);
    expect(result.summary).toBe("");
    expect(result.analyzedLines).toBe(3);
    expect(result.changedFiles).toBe(1);
  });

  it("logs the start of analysis", async () => {
    const analyzer = new DifferentialAnalyzer(makeConfig({ tokenBudget: 40_000 }));

    const result = await analyzer.analyzePRDiff(
      makeDiffInfo([{ additions: 4, deletions: 0, filename: "src/auth.ts", patch: SECRET_PATCH }]),
      "{}",
      PR_METADATA,
    );

    expect(appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        focusAreas: [],
        msg: "pr_differential_analysis_started",
        prNumber: 42,
        tokenBudget: 40_000,
      }),
    );
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
