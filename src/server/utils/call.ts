import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type z from "zod";

import { logger } from "@/server/logger/logger";

type CallWithFallbackProps<T> = {
  attemptMetadata?: Record<string, unknown>;
  frequencyPenalty?: number;
  maxOutputTokens?: number;
  models: string[];
  outputSchema: z.ZodSchema<T> | null;
  presencePenalty?: number;
  prompt: string;
  providerOptions?: Record<string, unknown>;
  stopSequences?: string[];
  system: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  useSearchGrounding?: boolean;
};

export async function callWithFallback<T>({
  attemptMetadata = {},
  frequencyPenalty = 0,
  maxOutputTokens = 65536,
  models,
  outputSchema,
  presencePenalty = 0,
  prompt,
  providerOptions,
  stopSequences,
  system,
  temperature = 0.1,
  topK = 1,
  topP = 0.1,
  useSearchGrounding = true,
}: CallWithFallbackProps<T>): Promise<T> {
  if (models.length === 0) {
    throw new Error("No models configured for fallback.");
  }

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      logger.info({
        model: modelName,
        msg: "Attempting model",
        ...attemptMetadata,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = {
        frequencyPenalty,
        maxOutputTokens,
        model: google(modelName),
        presencePenalty,
        prompt,
        providerOptions,
        stopSequences,
        system,
        temperature,
        topK,
        topP,
        useSearchGrounding,
      };

      if (outputSchema != null) {
        options.output = Output.object({ schema: outputSchema });
      }

      const result = await generateText(options);

      const finalValue = outputSchema == null ? result.text : result.output;

      logger.info({
        model: modelName,
        msg: "Model returned output",
        ...attemptMetadata,
      });
      return finalValue as T;
    } catch (err) {
      lastError = err;
      logger.warn({
        error: err instanceof Error ? { message: err.message } : String(err),
        model: modelName,
        msg: "Model call failed, trying next model",
      });
    }
  }

  throw lastError ?? new Error("All models failed");
}
