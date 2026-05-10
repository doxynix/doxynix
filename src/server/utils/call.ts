import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { metadata } from "@trigger.dev/sdk";
import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import type z from "zod";

import { appLogger } from "@/server/core/app-logger";
import {
  LLM_TEMPERATURE_STRATEGY,
  type LLMTaskType,
} from "@/server/modules/analysis/engine/core/scoring-constants";

import { taskLogger } from "./task-logger";
import { TRIGGER_CONFIG } from "../../shared/lib/trigger";

const tracedAi = wrapAISDK(ai);

type GoogleModelId = Parameters<typeof google>[0];

type CallWithFallbackProps<T> = {
  attemptMetadata?: Record<string, unknown>;
  frequencyPenalty?: number;
  maxOutputTokens?: number;
  models: GoogleModelId[];
  outputSchema: null | z.ZodSchema<T>;
  presencePenalty?: number;
  prompt: string;
  providerOptions?: {
    google?: GoogleLanguageModelOptions;
  };
  stopSequences?: string[];
  system: string;
  taskType?: LLMTaskType;
  temperature?: number;
  tools?: ai.ToolSet;
  topK?: number;
  topP?: number;
};

export async function callWithFallback<T>({
  attemptMetadata = {},
  frequencyPenalty = 0,
  maxOutputTokens = 65_536,
  models,
  outputSchema,
  presencePenalty = 0,
  prompt,
  providerOptions,
  stopSequences,
  system,
  taskType = "default",
  temperature,
  tools,
  topK,
  topP,
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
      appLogger.info({
        model: modelName,
        msg: "Attempting model",
        taskType,
        ...attemptMetadata,
      });
      if (outputSchema != null) {
        const result = await tracedAi.generateText({
          experimental_telemetry: {
            functionId: `gen-${taskType}`,
            isEnabled: true,
            metadata: {
              ...attemptMetadata,
              taskType,
            },
          },
          frequencyPenalty,
          maxOutputTokens,
          model: google(modelName),
          output: ai.Output.object({ schema: outputSchema }),
          presencePenalty,
          prompt,
          providerOptions,
          stopSequences,
          stopWhen: tools != null ? ai.stepCountIs(5) : undefined,
          system,
          temperature: finalTemperature,
          tools,
          topK: finalTopK,
          topP: finalTopP,
        });

        taskLogger.success(`AI: responded successfully.`);

        return result.output as T;
      }

      const result = tracedAi.streamText({
        experimental_telemetry: {
          functionId: `stream-${taskType}`,
          isEnabled: true,
          metadata: {
            ...attemptMetadata,
            taskType,
          },
        },
        frequencyPenalty,
        maxOutputTokens,
        model: google(modelName),
        presencePenalty,
        prompt,
        providerOptions,
        stopSequences,
        stopWhen: tools != null ? ai.stepCountIs(5) : undefined,
        system,
        temperature: finalTemperature,
        tools,
        topK: finalTopK,
        topP: finalTopP,
      });

      let fullText = "";
      const { aiChunks, aiThoughts, taskLogs } = TRIGGER_CONFIG.metadataKeys;

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          fullText += part.text;
          metadata.append(aiChunks, part.text);
        } else if (part.type === "reasoning-delta") {
          metadata.append(aiThoughts, part.text);
        } else if (part.type === "tool-call") {
          const timestamp = new Date().toLocaleTimeString();
          const logLine = `info:::${timestamp}:::Agent: Invoking tool [${part.toolName}]...`;

          metadata.append(taskLogs, logLine);
          appLogger.info({
            analysisId: attemptMetadata.analysisId,
            msg: `AI Tool Call: ${part.toolName}`,
          });
        } else if (part.type === "error") {
          const timestamp = new Date().toLocaleTimeString();
          metadata.append(taskLogs, `error:::${timestamp}:::AI Stream Error: ${part.error}`);
          appLogger.error({ error: part.error, msg: "Stream event error" });
        }
      }

      taskLogger.success(`AI: finished generation.`);
      return fullText as T;
    } catch (error) {
      lastError = error;
      appLogger.warn({
        error: error instanceof Error ? { message: error.message } : String(error),
        model: modelName,
        msg: "Model call failed, trying next model",
      });
    }
  }

  throw lastError ?? new Error("All models failed");
}
