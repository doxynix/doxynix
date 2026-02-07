import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import z from "zod";

import { logger } from "@/shared/lib/logger";

type CallWithFallbackProps<T> = {
  models: string[];
  prompt: string;
  system: string;
  outputSchema: z.ZodSchema<T> | null;
  providerOptions?: Record<string, unknown>;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  useSearchGrounding?: boolean;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  attemptMetadata?: Record<string, unknown>;
};

export async function callWithFallback<T>({
  models,
  prompt,
  system,
  outputSchema,
  providerOptions,
  useSearchGrounding = true,
  temperature = 0.1,
  maxTokens = 65536,
  frequencyPenalty = 0.0,
  presencePenalty = 0.0,
  topP = 0.1,
  topK = 1,
  stopSequences,
  attemptMetadata = {},
}: CallWithFallbackProps<T>): Promise<T> {
  if (models === null || models.length === 0) {
    throw new Error("No models configured for fallback.");
  }

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      logger.info({
        msg: "Attempting model",
        model: modelName,
        ...attemptMetadata,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = {
        model: google(modelName),
        providerOptions,
        useSearchGrounding,
        temperature,
        topP,
        topK,
        maxTokens,
        frequencyPenalty,
        presencePenalty,
        stopSequences,
        prompt,
        system,
      };

      if (outputSchema !== null) {
        options.output = Output.object({ schema: outputSchema });
      }

      const result = await generateText(options);

      const finalValue = outputSchema !== null ? result.output : result.text;

      if (finalValue !== null && finalValue !== undefined) {
        logger.info({
          msg: "Model returned output",
          model: modelName,
          ...attemptMetadata,
        });
        return finalValue as T;
      }
    } catch (err) {
      lastError = err;
      logger.warn({
        msg: "Model call failed, trying next model",
        model: modelName,
        error: err instanceof Error ? { message: err.message } : String(err),
      });
    }
  }

  throw lastError ?? new Error("All models failed");
}
