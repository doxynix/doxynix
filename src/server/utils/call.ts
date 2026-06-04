import { type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { metadata } from "@trigger.dev/sdk";
import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import type { z } from "zod";

import { TRIGGER_CONFIG } from "@/shared/constants/trigger";

import { appLogger } from "@/server/core/app-logger";
import { google } from "@/server/core/google";
import { isSchemaMismatchError } from "@/server/modules/analysis/engine/core/ai-result-normalize";
import {
  LLM_TEMPERATURE_STRATEGY,
  type LLMTaskType,
} from "@/server/modules/analysis/engine/core/scoring-constants";

import { taskLogger } from "../modules/analysis/logic/task-logger";

const tracedAi = wrapAISDK(ai);

type GoogleModelId = Parameters<typeof google>[0];

type CallWithFallbackProps<T> = {
  attemptMetadata?: Record<string, unknown>;
  frequencyPenalty?: number;
  maxOutputTokens?: number;
  models: GoogleModelId[];
  outputSchema: null | z.ZodType<T>;
  presencePenalty?: number;
  prompt: string;
  providerOptions?: {
    google?: GoogleLanguageModelOptions;
  };
  stepCount?: number;

  stopSequences?: string[];
  stream?: boolean;
  system: string;
  taskType?: LLMTaskType;
  temperature?: number;
  tools?: ai.ToolSet;
  topK?: number;
  topP?: number;
};

const LLM_API_TIMEOUT_MS = 300_000; // TIME: 5 минут

export async function callWithFallback<T>({
  attemptMetadata = {},
  frequencyPenalty = 0,
  maxOutputTokens = 65_536,
  models,
  outputSchema,
  presencePenalty = 0,
  prompt,
  providerOptions,
  stepCount = 10,
  stopSequences,
  stream = true,
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

  const strategy = LLM_TEMPERATURE_STRATEGY[taskType];
  const finalTemperature = temperature ?? strategy.temperature;
  const finalTopK = topK ?? strategy.topK;
  const finalTopP = topP ?? strategy.topP;

  let lastError: unknown = null;

  for (const modelName of models) {
    const attempts: Array<{ label: string; useTools: boolean }> =
      tools != null
        ? [
            { label: "structured+tools", useTools: true },
            { label: "structured", useTools: false },
          ]
        : [{ label: "structured", useTools: false }];

    for (const attempt of attempts) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        appLogger.warn({
          model: modelName,
          msg: `LLM API call timed out after ${LLM_API_TIMEOUT_MS / 1000}s. Aborting request...`,
          taskType,
          ...attemptMetadata,
        });
        abortController.abort();
      }, LLM_API_TIMEOUT_MS);

      try {
        appLogger.info({
          attempt: attempt.label,
          model: modelName,
          msg: "Attempting model",
          taskType,
          ...attemptMetadata,
        });

        if (outputSchema != null) {
          const activeTools = attempt.useTools ? tools : undefined;
          const result = await tracedAi.generateText({
            abortSignal: abortController.signal,
            experimental_telemetry: {
              functionId: `gen-${taskType}`,
              isEnabled: true,
              metadata: {
                ...attemptMetadata,
                attempt: attempt.label,
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
            stopWhen: activeTools != null ? ai.stepCountIs(stepCount) : undefined,
            system,
            temperature: finalTemperature,
            tools: activeTools,
            topK: finalTopK,
            topP: finalTopP,
          });

          clearTimeout(timeoutId);
          taskLogger.success(
            `AI (${String(attemptMetadata.phase ?? taskType)}): responded successfully.`
          );
          return result.output as T;
        }

        if (stream === false) {
          const activeTools = attempt.useTools ? tools : undefined;
          const result = await tracedAi.generateText({
            abortSignal: abortController.signal,
            experimental_telemetry: {
              functionId: `gen-text-${taskType}`,
              isEnabled: true,
              metadata: {
                ...attemptMetadata,
                attempt: attempt.label,
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
            stopWhen: activeTools != null ? ai.stepCountIs(stepCount) : undefined,
            system,
            temperature: finalTemperature,
            tools: activeTools,
            topK: finalTopK,
            topP: finalTopP,
          });

          clearTimeout(timeoutId);
          taskLogger.success(
            `AI Text (${String(attemptMetadata.phase ?? taskType)}): generated successfully.`
          );
          return result.text as unknown as T;
        }

        const activeTools = attempt.useTools ? tools : undefined;
        const result = tracedAi.streamText({
          abortSignal: abortController.signal,
          experimental_telemetry: {
            functionId: `stream-${taskType}`,
            isEnabled: true,
            metadata: {
              ...attemptMetadata,
              attempt: attempt.label,
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
          stopWhen: activeTools != null ? ai.stepCountIs(stepCount) : undefined,
          system,
          temperature: finalTemperature,
          tools: activeTools,
          topK: finalTopK,
          topP: finalTopP,
        });

        let fullText = "";
        let streamError: unknown = null;
        const { aiChunks, aiThoughts, taskLogs } = TRIGGER_CONFIG.metadataKeys;

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            fullText += part.text;
            try {
              metadata.append(aiChunks, part.text);
            } catch (error) {
              appLogger.debug({ error: error, msg: "Metadata append failed for text-delta" });
            }
          } else if (part.type === "reasoning-delta") {
            try {
              metadata.append(aiThoughts, part.text);
            } catch (error) {
              appLogger.debug({ error: error, msg: "Metadata append failed for reasoning-delta" });
            }
          } else if (part.type === "tool-call") {
            const timestamp = new Date().toLocaleTimeString();
            const logLine = `info:::${timestamp}:::Agent: Invoking tool [${part.toolName}]...`;

            try {
              metadata.append(taskLogs, logLine);
            } catch (error) {
              appLogger.debug({ error: error, msg: "Metadata append failed for tool-call log" });
            }
            appLogger.info({
              analysisId: attemptMetadata.analysisId,
              msg: `AI Tool Call: ${part.toolName}`,
            });
          } else if (part.type === "error") {
            const timestamp = new Date().toLocaleTimeString();
            try {
              metadata.append(taskLogs, `error:::${timestamp}:::AI Stream Error: ${part.error}`);
            } catch (error) {
              appLogger.debug({ error: error, msg: "Metadata append failed for error log" });
            }
            appLogger.error({ error: part.error, msg: "Stream event error" });
            streamError = part.error ?? new Error("Unknown stream error");
          }

          if (part.type === "finish" || part.type === "error") {
            clearTimeout(timeoutId);
            break;
          }
        }

        clearTimeout(timeoutId);
        if (streamError != null) {
          throw streamError;
        }

        taskLogger.success(`AI: finished generation.`);
        return fullText as T;
      } catch (error) {
        clearTimeout(timeoutId);

        lastError = error;
        const schemaMismatch = isSchemaMismatchError(error);
        appLogger.warn({
          attempt: attempt.label,
          error:
            error instanceof Error ? { message: error.message, name: error.name } : String(error),
          model: modelName,
          msg: schemaMismatch
            ? "Structured output schema mismatch, trying fallback attempt/model"
            : "Model call failed, trying next model",
        });

        if (schemaMismatch && attempt.useTools) {
          continue;
        }
      }
    }
  }

  throw lastError ?? new Error("All models failed");
}
