import { generateText, streamText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { callWithFallback } from "@/server/utils/call";

vi.mock("langsmith/experimental/vercel", () => ({
  wrapAISDK: vi.fn((sdk) => sdk),
}));

const googleState = vi.hoisted(() => ({
  google: vi.fn((modelName: string) => ({
    doGenerate: vi.fn(),
    doStream: vi.fn(),
    modelId: modelName,
  })),
}));
vi.mock("@ai-sdk/google", () => ({ google: googleState.google }));

vi.mock("ai", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    generateText: vi.fn(),
    Output: {
      ...actual.Output,
      object: vi.fn((input: { schema: z.ZodSchema }) => ({ kind: "object", ...input })),
    },
    streamText: vi.fn(),
  };
});

const loggerState = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/server/core/app-logger", () => ({ appLogger: loggerState }));
vi.mock("@trigger.dev/sdk", () => ({
  metadata: { append: vi.fn(), current: vi.fn(() => ({})), set: vi.fn() },
}));
vi.mock("./task-logger", () => ({
  taskLogger: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

describe("callWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when models list is empty", async () => {
    await expect(
      callWithFallback({
        models: [],
        outputSchema: null,
        prompt: "p",
        system: "s",
      })
    ).rejects.toThrow("No models configured for fallback.");
  });

  it("should return text when outputSchema is null and first model succeeds", async () => {
    vi.mocked(streamText).mockReturnValue({
      fullStream: (async function* () {
        yield { text: "final text", type: "text-delta" };
      })(),
    } as any);

    const result = await callWithFallback<string>({
      models: ["gemini-1"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    expect(result).toBe("final text");
    expect(vi.mocked(streamText)).toHaveBeenCalledOnce(); // ПРОВЕРЯЕМ streamText
  });

  it("should fallback to next model when previous model throws", async () => {
    vi.mocked(streamText)
      .mockRejectedValueOnce(new Error("Model A failed"))
      .mockReturnValueOnce({
        fullStream: (async function* () {
          yield { text: "fallback text", type: "text-delta" };
        })(),
      } as any);

    const result = await callWithFallback<string>({
      models: ["model-a", "model-b"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    expect(result).toBe("fallback text");
    expect(vi.mocked(streamText)).toHaveBeenCalledTimes(2); // ПРОВЕРЯЕМ streamText
  });

  it("should return structured output when outputSchema is provided", async () => {
    const outputSchema = z.object({ score: z.number() });
    vi.mocked(generateText).mockResolvedValue({
      output: { score: 95 },
    } as any);

    const result = await callWithFallback<{ score: number }>({
      models: ["model-a"],
      outputSchema,
      prompt: "prompt",
      system: "system",
    });

    expect(result).toEqual({ score: 95 });
    expect(vi.mocked(generateText)).toHaveBeenCalledOnce(); // ПРОВЕРЯЕМ generateText
  });

  it("should throw default all models failed error when model throws undefined", async () => {
    vi.mocked(streamText).mockReturnValueOnce({
      // eslint-disable-next-line sonarjs/generator-without-yield
      fullStream: (async function* () {
        throw undefined;
      })(),
    } as any);

    const callPromise = callWithFallback<string>({
      models: ["model-a"],
      outputSchema: null,
      prompt: "prompt",
      system: "system",
    });

    await expect(callPromise).rejects.toThrow("All models failed");
  });
});
