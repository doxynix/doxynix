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
    metricsJson,
    onboardingScore: 20,
    publicId: "an-1",
    resultJson,
    score: 70,
    securityScore: 60,
    status: "DONE",
    techDebtScore: 30,
  }) as unknown as LatestCompletedAnalysis;

const makeDoc = (overrides: Partial<StoredDocument>): StoredDocument => ({
  analysis: { publicId: "an-1" },
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  path: "README.md",
  publicId: "doc-1",
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
    const analysis = makeAnalysis(aiResult);

    const result = coerceAnalysisPayload(analysis);

    expect(result?.aiResult).toEqual(aiResult);
    expect(result?.analysis).toBe(analysis);
    expect(result?.metrics).toEqual({ totalFiles: 3 });
    expect(appLogger.warn).not.toHaveBeenCalled();
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
      makeDoc({ publicId: "api-1", type: "API" }),
      makeDoc({ publicId: "arch-1", type: "ARCHITECTURE" }),
      makeDoc({ publicId: "readme-1", type: "README" }),
      makeDoc({ path: "src/a.ts", publicId: "cd-1", type: "CODE_DOC" }),
    ]);

    expect(result.map((doc) => doc.publicId)).toEqual(["readme-1", "arch-1", "api-1", "cd-1"]);
  });

  it("keeps the doc with the newest updatedAt within a type", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        publicId: "arch-old",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({
        publicId: "arch-new",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-06-01T00:00:00.000Z"),
      }),
    ]);

    expect(result.map((doc) => doc.publicId)).toEqual(["arch-new"]);
  });

  it("dedupes CODE_DOC by path, not by type", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        path: "src/a.ts",
        publicId: "cd-old",
        type: "CODE_DOC",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({
        path: "src/a.ts",
        publicId: "cd-new",
        type: "CODE_DOC",
        updatedAt: new Date("2024-05-01T00:00:00.000Z"),
      }),
      makeDoc({ path: "src/b.ts", publicId: "cd-b", type: "CODE_DOC" }),
    ]);

    expect(result.map((doc) => doc.publicId)).toEqual(["cd-new", "cd-b"]);
  });

  it("full scenario: duplicates and types in arbitrary order", () => {
    const result = dedupeLatestDocsByType([
      makeDoc({
        publicId: "arch-old",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
      makeDoc({ path: "src/b.ts", publicId: "cd-b", type: "CODE_DOC" }),
      makeDoc({ publicId: "readme-1", type: "README" }),
      makeDoc({ path: "src/a.ts", publicId: "cd-1", type: "CODE_DOC" }),
      makeDoc({ publicId: "api-1", type: "API" }),
      makeDoc({
        path: "src/a.ts",
        publicId: "cd-new",
        type: "CODE_DOC",
        updatedAt: new Date("2024-05-01T00:00:00.000Z"),
      }),
      makeDoc({
        publicId: "arch-new",
        type: "ARCHITECTURE",
        updatedAt: new Date("2024-06-01T00:00:00.000Z"),
      }),
    ]);

    expect(result.map((doc) => doc.publicId)).toEqual([
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
      makeDoc({ path: "README.md", publicId: "readme-1", type: "README" }),
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
    const summary = toDocSummary(makeDoc({ publicId: "readme-1", type: "README" }), aiResult);

    expect(summary.source).toBeNull();
    expect(summary.status).toBe("missing");
  });

  it("CODE_DOC has no writer key → status null, source null", () => {
    const summary = toDocSummary(
      makeDoc({ path: "src/a.ts", publicId: "cd-1", type: "CODE_DOC" }),
      aiResult,
    );

    expect(summary.status).toBeNull();
    expect(summary.source).toBeNull();
  });
});
