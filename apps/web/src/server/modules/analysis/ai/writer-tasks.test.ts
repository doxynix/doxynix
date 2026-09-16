import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  buildApiWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildApiWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildArchitectureWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildArchitectureWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildChangelogWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildChangelogWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildContributingWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildContributingWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildReadmeWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildReadmeWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildRepositoryToolProfile: vi.fn(() => ({})),
  callWithFallback: vi.fn(async () => "llm-output"),
  getActiveModels: vi.fn(async () => ({
    AGENT: ["a1"],
    ARCHITECT: ["a1"],
    CARTOGRAPHER: ["a1"],
    FALLBACK: ["a1"],
    POWERFUL: ["a1"],
    SENTINEL: ["a1"],
    WRITER: ["w1", "w2"],
  })),
  getClientContext: vi.fn(),
  prisma: {
    analysis: { findFirst: vi.fn() },
    document: { findFirst: vi.fn() },
    repo: { findUnique: vi.fn() },
  },
  SAFETY_SETTINGS: [],
  unwrapAiText: vi.fn((x: unknown) => (typeof x === "string" ? x : JSON.stringify(x))),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/core/github/github-provider", () => ({
  getClientContext: mocks.getClientContext,
}));
vi.mock("@/server/utils/call", () => ({ callWithFallback: mocks.callWithFallback }));
vi.mock("@/server/utils/optimizers", () => ({ unwrapAiText: mocks.unwrapAiText }));
vi.mock("./ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
  SAFETY_SETTINGS: mocks.SAFETY_SETTINGS,
}));
vi.mock("./ai-tools", () => ({ buildRepositoryToolProfile: mocks.buildRepositoryToolProfile }));
vi.mock("./prompts-refactored", () => ({
  buildApiWriterSystemPrompt: mocks.buildApiWriterSystemPrompt,
  buildApiWriterUserPrompt: mocks.buildApiWriterUserPrompt,
  buildArchitectureWriterSystemPrompt: mocks.buildArchitectureWriterSystemPrompt,
  buildArchitectureWriterUserPrompt: mocks.buildArchitectureWriterUserPrompt,
  buildChangelogWriterSystemPrompt: mocks.buildChangelogWriterSystemPrompt,
  buildChangelogWriterUserPrompt: mocks.buildChangelogWriterUserPrompt,
  buildContributingWriterSystemPrompt: mocks.buildContributingWriterSystemPrompt,
  buildContributingWriterUserPrompt: mocks.buildContributingWriterUserPrompt,
  buildReadmeWriterSystemPrompt: mocks.buildReadmeWriterSystemPrompt,
  buildReadmeWriterUserPrompt: mocks.buildReadmeWriterUserPrompt,
}));

import {
  executeApiWriter,
  executeArchitectureWriter,
  executeContributingWriter,
  executeReadmeWriter,
} from "./writer-tasks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseArgs = {
  analysisId: "analysis-1",
  branch: "main",
  context: "context-str",
  engineeringDossierPayload: "dossier",
  language: "English",
  payload: "payload-str",
  repoId: "repo-pub",
  userId: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callWithFallback.mockResolvedValue("llm-output");
  mocks.unwrapAiText.mockImplementation((x: unknown) =>
    typeof x === "string" ? x : JSON.stringify(x),
  );
});

// ---------------------------------------------------------------------------
// executeReadmeWriter
// ---------------------------------------------------------------------------
describe("executeReadmeWriter", () => {
  it("returns llm result and calls deps correctly", async () => {
    const result = await executeReadmeWriter(
      baseArgs.analysisId,
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
      baseArgs.language,
      baseArgs.repoId,
      baseArgs.userId,
      baseArgs.branch,
    );

    expect(result).toEqual({ content: "llm-output", name: "readme", status: "llm" });
    expect(mocks.buildReadmeWriterSystemPrompt).toHaveBeenCalledWith("English");
    expect(mocks.buildReadmeWriterUserPrompt).toHaveBeenCalledWith(
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
    );
    expect(mocks.callWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ["w1", "w2"],
        outputSchema: null,
        taskType: "creative",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// executeApiWriter
// ---------------------------------------------------------------------------
describe("executeApiWriter", () => {
  it("returns llm result with correct prompt wiring", async () => {
    const result = await executeApiWriter(
      baseArgs.analysisId,
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
      baseArgs.language,
      baseArgs.repoId,
      baseArgs.userId,
      baseArgs.branch,
    );

    expect(result.name).toBe("api");
    expect(result.status).toBe("llm");
    expect(mocks.buildApiWriterSystemPrompt).toHaveBeenCalledWith("English");
    expect(mocks.buildApiWriterUserPrompt).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// executeContributingWriter
// ---------------------------------------------------------------------------
describe("executeContributingWriter", () => {
  it("returns llm result with correct prompt wiring", async () => {
    const result = await executeContributingWriter(
      baseArgs.analysisId,
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
      baseArgs.language,
      baseArgs.repoId,
      baseArgs.userId,
      baseArgs.branch,
    );

    expect(result.name).toBe("contributing");
    expect(result.status).toBe("llm");
    expect(mocks.buildContributingWriterSystemPrompt).toHaveBeenCalledWith("English");
  });
});

// ---------------------------------------------------------------------------
// executeArchitectureWriter
// ---------------------------------------------------------------------------
describe("executeArchitectureWriter", () => {
  it("passes 7 args to buildArchitectureWriterUserPrompt", async () => {
    const result = await executeArchitectureWriter(
      baseArgs.analysisId,
      "arch-payload",
      "risks-payload",
      "onboard-payload",
      "module-dep-ctx",
      "dossier",
      "arch-ctx",
      "allowed",
      "English",
      "repo-pub",
      1,
      "main",
    );

    expect(result.name).toBe("architecture");
    expect(result.status).toBe("llm");
    expect(mocks.buildArchitectureWriterUserPrompt).toHaveBeenCalledWith(
      "arch-payload",
      "risks-payload",
      "onboard-payload",
      "module-dep-ctx",
      "dossier",
      "arch-ctx",
      "allowed",
    );
  });
});
