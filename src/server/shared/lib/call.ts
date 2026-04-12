import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type z from "zod";

import { LLM_TEMPERATURE_STRATEGY, type LLMTaskType } from "../engine/core/scoring-constants";
import { logger } from "../infrastructure/logger";

type CallWithFallbackProps<T> = {
  attemptMetadata?: Record<string, unknown>;
  frequencyPenalty?: number;
  maxOutputTokens?: number;
  models: string[];
  outputSchema: null | z.ZodSchema<T>;
  presencePenalty?: number;
  prompt: string;
  providerOptions?: Record<string, unknown>;
  stopSequences?: string[];
  system: string;
  taskType?: LLMTaskType;
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
  taskType = "default",
  temperature,
  topK,
  topP,
  useSearchGrounding = true,
}: CallWithFallbackProps<T>): Promise<T> {
  if (models.length === 0) {
    throw new Error("No models configured for fallback.");
  }

  // Apply temperature strategy if not explicitly provided
  const strategy = LLM_TEMPERATURE_STRATEGY[taskType];
  const finalTemperature = temperature ?? strategy.temperature;
  const finalTopK = topK ?? strategy.topK;
  const finalTopP = topP ?? strategy.topP;

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      logger.info({
        model: modelName,
        msg: "Attempting model",
        taskType,
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
        temperature: finalTemperature,
        topK: finalTopK,
        topP: finalTopP,
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
    } catch (error) {
      lastError = error;
      logger.warn({
        error: error instanceof Error ? { message: error.message } : String(error),
        model: modelName,
        msg: "Model call failed, trying next model",
      });
    }
  }

  throw lastError ?? new Error("All models failed");
}
