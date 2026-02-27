import { generateText, Output } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { callWithFallback } from "@/server/utils/call";

const googleState = vi.hoisted(() => ({
  google: vi.fn((modelName: string) => `google:${modelName}`),
}));

const loggerState = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  google: googleState.google,
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn((input: { schema: z.ZodSchema }) => ({ kind: "object", ...input })),
  },
}));

vi.mock("@/server/logger/logger", () => ({
  logger: loggerState,
}));

describe("callWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when models list is empty", async () => {
    const options = {
      models: [],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    };

    const callPromise = callWithFallback(options);

    await expect(callPromise).rejects.toThrow("No models configured for fallback.");
  });

  it("should return text when outputSchema is null and first model succeeds", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "final text",
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await callWithFallback<string>({
      attemptMetadata: { requestId: "req-1" },
      models: ["gemini-1"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    expect(result).toBe("final text");
    expect(googleState.google).toHaveBeenCalledWith("gemini-1");
    expect(vi.mocked(generateText)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "google:gemini-1",
        prompt: "prompt",
        system: "system",
      })
    );
    expect(loggerState.info).toHaveBeenCalledTimes(2);
  });

  it("should fallback to next model when previous model throws", async () => {
    vi.mocked(generateText)
      .mockRejectedValueOnce(new Error("Model A failed"))
      .mockResolvedValueOnce({
        text: "fallback text",
      } as Awaited<ReturnType<typeof generateText>>);

    const result = await callWithFallback<string>({
      models: ["model-a", "model-b"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    expect(result).toBe("fallback text");
    expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
    expect(loggerState.warn).toHaveBeenCalledWith({
      error: { message: "Model A failed" },
      model: "model-a",
      msg: "Model call failed, trying next model",
    });
  });

  it("should return structured output when outputSchema is provided", async () => {
    const outputSchema = z.object({
      score: z.number(),
      verdict: z.string(),
    });
    vi.mocked(generateText).mockResolvedValue({
      output: { score: 95, verdict: "ok" },
      text: "unused text",
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await callWithFallback<{ score: number; verdict: string }>({
      models: ["model-a"],
      outputSchema,
      prompt: "prompt",
      system: "system",
    });

    expect(vi.mocked(Output.object)).toHaveBeenCalledWith({ schema: outputSchema });
    expect(result).toEqual({ score: 95, verdict: "ok" });
  });

  it("should throw default all models failed error when model throws undefined", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(undefined);

    const callPromise = callWithFallback<string>({
      models: ["model-a"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    await expect(callPromise).rejects.toThrow("All models failed");
  });
});
