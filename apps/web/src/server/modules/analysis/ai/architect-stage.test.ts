import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any module-under-test imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  buildAnalysisSystemPrompt: vi.fn(() => "sys"),
  buildAnalysisUserPrompt: vi.fn(() => "usr"),
  buildRepositoryToolProfile: vi.fn(() => ({})),
  buildStageContextPack: vi.fn(() => ({ context: "ctx-str", debug: { selectedTokens: 7 } })),
  callWithFallback: vi.fn(),
  collectArchitectPreferredPaths: vi.fn(() => ["a.ts"]),
  getActiveModels: vi.fn(),
  taskLogger: {
    error: vi.fn(),
    finalize: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    milestone: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: mocks.taskLogger,
}));
vi.mock("@/server/utils/call", () => ({ callWithFallback: mocks.callWithFallback }));
vi.mock("../logic/architect-digest", () => ({
  collectArchitectPreferredPaths: mocks.collectArchitectPreferredPaths,
}));
vi.mock("../logic/context-manager", () => ({
  buildStageContextPack: mocks.buildStageContextPack,
}));
vi.mock("./ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
  SAFETY_SETTINGS: [],
}));
vi.mock("./ai-tools", () => ({ buildRepositoryToolProfile: mocks.buildRepositoryToolProfile }));
vi.mock("./prompts-refactored", () => ({
  buildAnalysisSystemPrompt: mocks.buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt: mocks.buildAnalysisUserPrompt,
}));

// Normalizer + schema stay REAL; appLogger used by the normalizer is mocked above.
import {
  aiGenerationSchema,
  normalizeAiGenerationOutput,
} from "../engine/core/ai-result-normalize";
import type { buildArchitectDigest } from "../logic/architect-digest";
import { executeArchitectPhase } from "./architect-stage";

type ArchitectDigest = ReturnType<typeof buildArchitectDigest>;

const validFiles = [{ content: "export const a = 1;", path: "src/a.ts" }];

// Only the fields touched by the deterministic fallback path are populated.
const digestFixture = {
  facts: [
    {
      category: "architecture",
      confidence: "high",
      evidencePaths: ["src/a.ts"],
      id: "fact-1",
      title: "Uses layered modules",
    },
  ],
  findings: [
    {
      category: "security",
      confidence: 80,
      evidencePaths: ["src/a.ts"],
      id: "finding-1",
      score: 62,
      severity: "HIGH",
      summary: "Input is not sanitized",
      title: "Unsanitized input",
    },
  ],
  metrics: {
    languages: ["TypeScript"],
    securityScore: 70,
  },
  projectMap: {
    overview: "A compact monorepo",
  },
  sections: {
    api_reference: { summary: ["REST endpoints documented"] },
    architecture: { summary: ["Layered architecture"] },
    onboarding: { summary: ["Run bun install"] },
    risks: { summary: ["Some risk"] },
  },
} as never;

function makeRawAiResult() {
  return {
    executive_summary: {
      architecture_style: "Modular monolith",
      key_innovations: ["Dx tooling"],
      purpose: "Automated repository intelligence report",
      stack_details: ["TypeScript"],
    },
    findings: [],
    onboarding_guide: { prerequisites: [], setup_steps: [] },
    refactoring_targets: [],
    repository_facts: [],
    sections: {
      api_structure: "REST",
      data_flow: "Bounded context",
      security_audit: { risks: [], score: 5 },
    },
    vulnerabilities: [],
  };
}

describe("executeArchitectPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes a successful LLM result and marks both architect and mapper as successful", async () => {
    const raw = makeRawAiResult();
    // Sanity check: the raw fixture satisfies the real generation schema.
    expect(normalizeAiGenerationOutput(raw).executive_summary.purpose).toBe(
      "Automated repository intelligence report",
    );

    mocks.getActiveModels.mockResolvedValue({
      ARCHITECT: ["arch-1"],
      FALLBACK: ["fb-1"],
      POWERFUL: ["pf-1"],
    });
    mocks.callWithFallback.mockResolvedValue(raw);

    const result = await executeArchitectPhase(
      validFiles,
      digestFixture,
      "analysis-1",
      "Be thorough",
      "SAFE",
      "English",
      "repo-1",
      7,
      "main",
    );

    expect(result.analysisRuntime).toEqual({
      architect: { source: "llm", status: "success" },
      mapper: { source: "llm", status: "success" },
    });

    expect(mocks.buildStageContextPack).toHaveBeenCalledWith({
      files: validFiles,
      preferredPaths: ["a.ts"],
      stage: "architect",
    });
    expect(mocks.taskLogger.info).toHaveBeenCalledWith(
      "Architect: Context assembled (7 tokens). Starting reasoning...",
    );
    expect(mocks.callWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptMetadata: expect.objectContaining({
          analysisId: "analysis-1",
          phase: "architect",
        }),
        models: ["pf-1", "arch-1", "fb-1"],
        outputSchema: aiGenerationSchema,
        prompt: "usr",
        providerOptions: { google: { safetySettings: [] } },
        system: "sys",
        taskType: "reasoning",
        tools: {},
      }),
    );
    expect(mocks.buildRepositoryToolProfile).toHaveBeenCalledWith("architect", 7, "repo-1", "main");
    expect(mocks.taskLogger.success).toHaveBeenCalledOnce();
    expect(mocks.appLogger.info).toHaveBeenCalledOnce();
  });

  it("returns a deterministic partial fallback on schema mismatch", async () => {
    mocks.getActiveModels.mockResolvedValue({
      ARCHITECT: ["arch-1"],
      FALLBACK: ["fb-1"],
      POWERFUL: ["pf-1"],
    });
    mocks.callWithFallback.mockRejectedValue(new Error("output did not match schema"));

    const result = await executeArchitectPhase(
      validFiles,
      digestFixture,
      "analysis-1",
      "Be thorough",
      "SAFE",
      "English",
      "repo-1",
      7,
      "main",
    );

    expect(result.analysisRuntime).toEqual({
      architect: { reason: "schema_mismatch_fallback", source: "llm", status: "partial" },
      mapper: { source: "llm", status: "success" },
    });
    expect(result.executive_summary.purpose).toBe("Layered architecture");
    expect(result.sections.security_audit.score).toBe(7);
    expect(mocks.taskLogger.warn).toHaveBeenCalledOnce();
  });

  it("rethrows generic errors after logging a warning", async () => {
    mocks.getActiveModels.mockResolvedValue({
      ARCHITECT: ["arch-1"],
      FALLBACK: ["fb-1"],
      POWERFUL: ["pf-1"],
    });
    mocks.callWithFallback.mockRejectedValue(new Error("catastrophic failure"));

    await expect(
      executeArchitectPhase(
        validFiles,
        digestFixture,
        "analysis-1",
        "Be thorough",
        "SAFE",
        "English",
        "repo-1",
        7,
        "main",
      ),
    ).rejects.toThrow("catastrophic failure");

    expect(mocks.taskLogger.error).toHaveBeenCalledOnce();
    expect(mocks.appLogger.warn).toHaveBeenCalled();
  });

  describe("digestFixture type sanity", () => {
    it("is shaped like a real ArchitectDigest", () => {
      const typed: ArchitectDigest = digestFixture;
      expect(typed.projectMap.overview).toBe("A compact monorepo");
    });
  });
});
