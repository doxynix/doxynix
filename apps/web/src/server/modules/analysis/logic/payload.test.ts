import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { appLogger } from "@/server/core/app-logger";

import type { LatestCompletedAnalysis } from "../analysis.repository";
import type { AIResult } from "../engine/core/analysis-result.schemas";
import { VALID_REPO_METRICS } from "../engine/core/metrics.fixtures";
import {
  coerceAnalysisPayload,
  dedupeLatestDocsByType,
  normalizeWriterStatuses,
  toDocSummary,
} from "./payload";
import type { StoredDocument } from "./structure-shared";

const aiResult: AIResult = {
  analysisRuntime: {
    writers: {
      api: "llm",
      architecture: "missing",
      changelog: "failed",
      contributing: "llm",
      readme: "missing",
    },
  },
  executive_summary: { architecture_style: "Layered", purpose: "p", stack_details: [] },
  onboarding_guide: { prerequisites: [], setup_steps: [] },
  refactoring_targets: [],
  sections: {
    api_structure: "REST",
    data_flow: "flow",
    security_audit: { risks: [], score: 5 },
  },
};

const makeAnalysis = (
  resultJson: unknown,
  metricsJson: unknown = { totalFiles: 3 },
): LatestCompletedAnalysis =>
  ({
    commitSha: "abc123",
    complexityScore: 50,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    id: "an-1",
    metricsJson,
    onboardingScore: 20,
    resultJson,
    score: 70,
    securityScore: 60,
    status: "DONE",
    techDebtScore: 30,
  }) as unknown as LatestCompletedAnalysis;

const makeDoc = (overrides: Partial<StoredDocument>): StoredDocument => ({
  analysis: { id: "an-1" },
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  id: "doc-1",
  path: "README.md",
  type: "README",
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  version: "1",
  ...overrides,
});

describe("coerceAnalysisPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("null/undefined → null", () => {
    expect(coerceAnalysisPayload(null)).toBeNull();
    expect(coerceAnalysisPayload(undefined)).toBeNull();
  });

  it("missing metricsJson/resultJson → null", () => {
    expect(coerceAnalysisPayload(makeAnalysis(null))).toBeNull();
    expect(coerceAnalysisPayload(makeAnalysis({}, null))).toBeNull();
  });

  it("valid resultJson parses through aiSchema without warn", () => {
    const analysis = makeAnalysis(aiResult, VALID_REPO_METRICS);

    const result = coerceAnalysisPayload(analysis);

    expect(result?.aiResult).toEqual(aiResult);
    expect(result?.analysis).toBe(analysis);
    expect(result?.metrics).toEqual(VALID_REPO_METRICS);
    expect(appLogger.warn).not.toHaveBeenCalled();
  });

  it("drops a malformed changeCoupling instead of passing the raw JSON through", () => {
    const result = coerceAnalysisPayload(
      makeAnalysis(aiResult, { ...VALID_REPO_METRICS, changeCoupling: "nope" }),
    );

    expect(result).not.toBeNull();
    expect(result?.metrics).toBeDefined();
    expect(result?.metrics.changeCoupling).toBeUndefined();
  });

  it("keeps the rest of a metrics blob whose one bad field is rejected", () => {
    const result = coerceAnalysisPayload(
      makeAnalysis(aiResult, { ...VALID_REPO_METRICS, healthScore: "eighty" }),
    );

    expect(result).not.toBeNull();
    expect(result?.metrics.totalLoc).toBe(0);
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ id: "an-1", msg: expect.stringContaining("metricsJson") }),
    );
  });

  it("invalid resultJson logs warn and returns raw data as-is", () => {
    const invalid = { ...aiResult, refactoring_targets: "oops" };
    const analysis = makeAnalysis(invalid);

    const result = coerceAnalysisPayload(analysis);

    expect(result?.aiResult).toBe(invalid);
    expect(result?.analysis).toBe(analysis);
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ id: "an-1", msg: "Zod mismatch" }),
    );
  });
});

describe("dedupeLatestDocsByType", () => {
  it("empty input → empty result", () => {
    expect(dedupeLatestDocsByType([])).toEqual([]);
  });

  it("sorts by DOC_TYPE_ORDER: README, ARCHITECTURE, API, CODE_DOC", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({ id: "api-1", type: "API" }),
      makeDoc({ id: "arch-1", type: "ARCHITECTURE" }),
      makeDoc({ id: "readme-1", type: "README" }),
      makeDoc({ id: "cd-1", path: "src/a.ts", type: "CODE_DOC" }),
    ]);

    expect(result.map((doc) => doc.id)).toEqual(["readme-1", "arch-1", "api-1", "cd-1"]);
  });

  it("keeps the doc with the newest updatedAt within a type", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        id: "arch-old",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({
        id: "arch-new",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-06-01T00:00:00.000Z"),
      }),
    ]);

    expect(result.map((doc) => doc.id)).toEqual(["arch-new"]);
  });

  it("dedupes CODE_DOC by path, not by type", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        id: "cd-old",
        path: "src/a.ts",
        type: "CODE_DOC",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({
        id: "cd-new",
        path: "src/a.ts",
        type: "CODE_DOC",
        updatedAt: new Date("2024-05-01T00:00:00.000Z"),
      }),
      makeDoc({ id: "cd-b", path: "src/b.ts", type: "CODE_DOC" }),
    ]);

    expect(result.map((doc) => doc.id)).toEqual(["cd-new", "cd-b"]);
  });

  it("full scenario: duplicates and types in arbitrary order", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        id: "arch-old",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({ id: "cd-b", path: "src/b.ts", type: "CODE_DOC" }),
      makeDoc({ id: "readme-1", type: "README" }),
      makeDoc({ id: "cd-1", path: "src/a.ts", type: "CODE_DOC" }),
      makeDoc({ id: "api-1", type: "API" }),
      makeDoc({
        id: "cd-new",
        path: "src/a.ts",
        type: "CODE_DOC",
        updatedAt: new Date("2024-05-01T00:00:00.000Z"),
      }),
      makeDoc({
        id: "arch-new",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-06-01T00:00:00.000Z"),
      }),
    ]);

    expect(result.map((doc) => doc.id)).toEqual([
      "readme-1",
      "arch-new",
      "api-1",
      "cd-new",
      "cd-b",
    ]);
  });
});

describe("normalizeWriterStatuses", () => {
  it("null → all statuses null", () => {
    expect(normalizeWriterStatuses(null)).toEqual({
      api: null,
      architecture: null,
      changelog: null,
      contributing: null,
      readme: null,
    });
  });

  it("without analysisRuntime.writers → all statuses null", () => {
    const { analysisRuntime: _analysisRuntime, ...withoutRuntime } = aiResult;

    expect(normalizeWriterStatuses(withoutRuntime)).toEqual({
      api: null,
      architecture: null,
      changelog: null,
      contributing: null,
      readme: null,
    });
  });

  it("maps writer statuses by key", () => {
    expect(normalizeWriterStatuses(aiResult)).toEqual({
      api: "llm",
      architecture: "missing",
      changelog: "failed",
      contributing: "llm",
      readme: "missing",
    });
  });
});

describe("toDocSummary", () => {
  it('llm status yields source "llm"', () => {
    const withLlm = { ...aiResult, analysisRuntime: { writers: { readme: "llm" as const } } };

    const summary = toDocSummary(
      makeDoc({ id: "readme-1", path: "README.md", type: "README" }),
      withLlm,
    );

    expect(summary).toEqual({
      id: "readme-1",
      path: "README.md",
      source: "llm",
      status: "llm",
      type: "README",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      version: "1",
    });
  });

  it("non-llm status yields null source", () => {
    const summary = toDocSummary(makeDoc({ id: "readme-1", type: "README" }), aiResult);

    expect(summary.source).toBeNull();
    expect(summary.status).toBe("missing");
  });

  it("CODE_DOC has no writer key → status null, source null", () => {
    const summary = toDocSummary(
      makeDoc({ id: "cd-1", path: "src/a.ts", type: "CODE_DOC" }),
      aiResult,
    );

    expect(summary.status).toBeNull();
    expect(summary.source).toBeNull();
  });
});
