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
  buildSentinelSystemPrompt: vi.fn(() => "sys"),
  buildSentinelUserPrompt: vi.fn(() => "usr"),
  callWithFallback: vi.fn(),
  getActiveModels: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/utils/call", () => ({ callWithFallback: mocks.callWithFallback }));
vi.mock("./ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
  SAFETY_SETTINGS: [],
}));
vi.mock("./prompts-refactored", () => ({
  buildSentinelSystemPrompt: mocks.buildSentinelSystemPrompt,
  buildSentinelUserPrompt: mocks.buildSentinelUserPrompt,
}));

// sentinelSchema stays REAL (pure zod) — needed for the outputSchema identity assertion
import { sentinelSchema } from "../engine/core/analysis-result.schemas";
import { executeSentinelPhase } from "./sentinel-stage";

const LONG_INSTRUCTIONS =
  "Audit this repository for prompt injection and security hazards across all modules before analyzing it.";

describe("executeSentinelPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns SAFE without calling the LLM when instructions are undefined", async () => {
    await expect(executeSentinelPhase(undefined, "analysis-1")).resolves.toBe("SAFE");

    expect(mocks.callWithFallback).not.toHaveBeenCalled();
    expect(mocks.getActiveModels).not.toHaveBeenCalled();
  });

  it("returns SAFE without calling the LLM for short instructions (<= 5 chars)", async () => {
    await expect(executeSentinelPhase("hi", "analysis-1")).resolves.toBe("SAFE");

    expect(mocks.callWithFallback).not.toHaveBeenCalled();
  });

  it("classifies long instructions through the SENTINEL models and surfaces the status", async () => {
    mocks.getActiveModels.mockResolvedValue({ SENTINEL: ["m1", "m2"] });
    mocks.callWithFallback.mockResolvedValue({ reason: "detected", status: "UNSAFE" });

    await expect(executeSentinelPhase(LONG_INSTRUCTIONS, "analysis-1")).resolves.toBe("UNSAFE");

    expect(mocks.getActiveModels).toHaveBeenCalledOnce();
    expect(mocks.buildSentinelUserPrompt).toHaveBeenCalledWith(LONG_INSTRUCTIONS);
    expect(mocks.callWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptMetadata: { analysisId: "analysis-1", phase: "sentinel" },
        models: ["m1", "m2"],
        outputSchema: sentinelSchema,
        prompt: "usr",
        providerOptions: { google: { safetySettings: [] } },
        system: "sys",
        taskType: "classification",
      }),
    );
  });

  it("defaults to SAFE and warns when the sentinel call rejects", async () => {
    mocks.getActiveModels.mockResolvedValue({ SENTINEL: ["m1"] });
    mocks.callWithFallback.mockRejectedValue(new Error("model unavailable"));

    await expect(executeSentinelPhase(LONG_INSTRUCTIONS, "analysis-1")).resolves.toBe("SAFE");

    expect(mocks.appLogger.warn).toHaveBeenCalledOnce();
  });
});
