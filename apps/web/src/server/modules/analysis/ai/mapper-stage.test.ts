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
  buildMapperSkeleton: vi.fn(() => "skeleton-context"),
  buildMapperSystemPrompt: vi.fn(() => "sys"),
  buildMapperUserPrompt: vi.fn(() => "usr"),
  buildRepositoryToolProfile: vi.fn(() => ({})),
  callWithFallback: vi.fn(),
  getActiveModels: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/utils/call", () => ({ callWithFallback: mocks.callWithFallback }));
vi.mock("../logic/mapper-skeleton", () => ({ buildMapperSkeleton: mocks.buildMapperSkeleton }));
vi.mock("./ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
  SAFETY_SETTINGS: [],
}));
vi.mock("./ai-tools", () => ({ buildRepositoryToolProfile: mocks.buildRepositoryToolProfile }));
vi.mock("./prompts-refactored", () => ({
  buildMapperSystemPrompt: mocks.buildMapperSystemPrompt,
  buildMapperUserPrompt: mocks.buildMapperUserPrompt,
}));

// Normalizer + schema stay REAL (pure zod/string logic); appLogger is mocked above.
import { projectMapGenerationSchema } from "../engine/core/ai-result-normalize";
import { executeMapperPhase } from "./mapper-stage";

const validFiles = [
  { content: "export const a = 1;", path: "src/a.ts" },
  { content: "export const b = 2;", path: "src/b.ts" },
];

function makeHardMetrics() {
  return {} as never;
}

const evidence = {} as never;

function makeRawProjectMap() {
  return {
    modules: [
      { path: "apps/web", responsibility: "Web platform", type: "app" },
      { path: "packages/shared", responsibility: "Shared types", type: "library" },
    ],
    overview: "A TypeScript monorepo",
  };
}

describe("executeMapperPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes a successful LLM project map and forwards the LLM configuration", async () => {
    const raw = makeRawProjectMap();
    const hardMetrics = makeHardMetrics();
    mocks.getActiveModels.mockResolvedValue({ CARTOGRAPHER: ["c1", "c2"] });
    mocks.callWithFallback.mockResolvedValue(raw);

    const result = await executeMapperPhase(
      validFiles,
      hardMetrics,
      evidence,
      "analysis-1",
      7,
      "repo-1",
      "main",
    );

    expect(result.overview).toBe("A TypeScript monorepo");
    expect(result.modules.map((module) => module.path)).toEqual(["apps/web", "packages/shared"]);

    expect(mocks.buildMapperSkeleton).toHaveBeenCalledWith(validFiles, hardMetrics, evidence);
    expect(mocks.callWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptMetadata: { analysisId: "analysis-1", phase: "mapper" },
        models: ["c1", "c2"],
        outputSchema: projectMapGenerationSchema,
        prompt: "usr",
        providerOptions: { google: { safetySettings: [] } },
        system: "sys",
        taskType: "reasoning",
        tools: {},
      }),
    );
    expect(mocks.buildRepositoryToolProfile).toHaveBeenCalledWith("mapper", 7, "repo-1", "main");
    expect(mocks.appLogger.debug).toHaveBeenCalledOnce();
  });

  it("builds a skeleton fallback when the LLM output did not match the schema", async () => {
    const hardMetricsWithModules = {
      documentationInput: {
        architecture: {
          modules: [
            { categories: ["app", "ui"], path: "apps/web" },
            { categories: [], path: "packages/shared" },
          ],
        },
      },
    } as never;
    mocks.getActiveModels.mockResolvedValue({ CARTOGRAPHER: ["c1"] });
    mocks.callWithFallback.mockRejectedValue(new Error("LLM output did not match schema"));

    const result = await executeMapperPhase(
      validFiles,
      hardMetricsWithModules,
      evidence,
      "analysis-1",
      7,
      "repo-1",
      "main",
    );

    expect(result.overview).toBe(
      "Topology inferred from static analysis after mapper schema mismatch.",
    );
    expect(result.modules).toHaveLength(2);
    expect(result.modules[0]).toMatchObject({
      path: "apps/web",
      responsibility: "app, ui",
      type: "app",
    });
    expect(result.modules[1]).toMatchObject({
      path: "packages/shared",
      responsibility: "Core module",
      type: "module",
    });
    expect(mocks.appLogger.warn).toHaveBeenCalled();
  });

  it("rethrows generic errors after logging a warning", async () => {
    mocks.getActiveModels.mockResolvedValue({ CARTOGRAPHER: ["c1"] });
    mocks.callWithFallback.mockRejectedValue(new Error("boom"));

    await expect(
      executeMapperPhase(
        validFiles,
        makeHardMetrics(),
        evidence,
        "analysis-1",
        7,
        "repo-1",
        "main",
      ),
    ).rejects.toThrow("boom");

    expect(mocks.appLogger.warn).toHaveBeenCalled();
  });
});
