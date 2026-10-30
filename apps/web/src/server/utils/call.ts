import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { metadata } from "@trigger.dev/sdk";
import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import type * as z from "zod";

import { TRIGGER_CONFIG } from "@/shared/config/trigger";

import { google } from "@/server/core/ai/google";
import { LLM_TEMPERATURE_STRATEGY, type LLMTaskType } from "@/server/core/ai/llm-temperature";
import { isSchemaMismatchError } from "@/server/core/ai/schema-mismatch";
import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { prisma } from "@/server/core/db";
import { type TokenUsage, UnknownModelPriceError } from "@/server/core/usage/price";
import { releaseUsage, reserveUsage, settleUsage } from "@/server/core/usage/usage";
import { taskLogger } from "@/server/utils/task-logger";

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

const LLM_API_TIMEOUT_MS = 300_000; // TIME: 5 minutes

type UsageMeter = {
  analysisId: null | string;
  workspaceId: string;
};

type MeterUsage = {
  cachedInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

function readString(source: Record<string, unknown>, key: string): null | string {
  const value = source[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

// Analysis stages only know the analysis id; the workspace comes from its repo. Calls without
// either context are not metered, but they never fail because of that.
async function resolveUsageMeter(
  attemptMetadata: Record<string, unknown>,
): Promise<null | UsageMeter> {
  const analysisId = readString(attemptMetadata, "analysisId");
  const workspaceId = readString(attemptMetadata, "workspaceId");

  if (workspaceId != null) {
    return { analysisId, workspaceId };
  }

  if (analysisId == null) {
    return null;
  }

  const analysis = await prisma.analysis.findUnique({
    select: { repo: { select: { workspaceId: true } } },
    where: { id: analysisId },
  });
  const resolved = analysis?.repo.workspaceId ?? null;

  return resolved == null ? null : { analysisId, workspaceId: resolved };
}

function estimateTokens(system: string, prompt: string, maxOutputTokens: number): number {
  return Math.ceil((system.length + prompt.length) / 4) + maxOutputTokens;
}

function toTokenUsage(usage: MeterUsage | null | undefined): TokenUsage {
  return {
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
}

async function reserveAttempt(
  meter: null | UsageMeter,
  idempotencyKey: string,
  estimatedTokens: number,
): Promise<boolean> {
  if (meter == null) {
    return false;
  }

  try {
    await reserveUsage(prisma, {
      analysisId: meter.analysisId,
      estimatedTokens,
      idempotencyKey,
      workspaceId: meter.workspaceId,
    });

    return true;
  } catch (error) {
    appLogger.warn({
      error: error instanceof Error ? error.message : String(error),
      msg: "Usage reservation failed",
    });

    return false;
  }
}

async function releaseAttempt(meter: null | UsageMeter, idempotencyKey: string): Promise<void> {
  if (meter == null) {
    return;
  }

  try {
    await releaseUsage(prisma, {
      analysisId: meter.analysisId,
      idempotencyKey,
      workspaceId: meter.workspaceId,
    });
  } catch (error) {
    appLogger.warn({
      error: error instanceof Error ? error.message : String(error),
      msg: "Usage release failed",
    });
  }
}

async function settleAttempt(
  meter: null | UsageMeter,
  idempotencyKey: string,
  model: string,
  usage: MeterUsage | null | undefined,
): Promise<void> {
  if (meter == null) {
    return;
  }

  try {
    await settleUsage(prisma, {
      analysisId: meter.analysisId,
      idempotencyKey,
      model,
      provider: "google",
      usage: toTokenUsage(usage),
      workspaceId: meter.workspaceId,
    });
  } catch (error) {
    if (error instanceof UnknownModelPriceError) {
      try {
        await upsertBillingIssue(prisma, {
          dedupeKey: `unknown_model_price:${model}`,
          details: { model },
          kind: "UNKNOWN_MODEL_PRICE",
          severity: "CRITICAL",
          source: "usage_metering",
        });
      } catch (issueError) {
        appLogger.error({
          error: issueError instanceof Error ? issueError.message : String(issueError),
          msg: "Unknown model price issue write failed",
        });
      }
    }

    appLogger.warn({
      error: error instanceof Error ? error.message : String(error),
      model,
      msg: "Usage settlement failed",
    });

    await releaseAttempt(meter, idempotencyKey);
  }
}

export async function callWithFallback<T>({
  attemptMetadata = {},
  frequencyPenalty,
  maxOutputTokens = 65_536,
  models,
  outputSchema,
  presencePenalty,
  prompt,
  providerOptions,
  stepCount = 10,
  stopSequences,
  stream = true,
  system: instructions,
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

  // Metering never blocks the model call: a failure to resolve the workspace only means this call
  // is not attributed.
  const meter = await resolveUsageMeter(attemptMetadata).catch((error) => {
    appLogger.warn({
      error: error instanceof Error ? error.message : String(error),
      msg: "Usage meter resolution failed",
    });

    return null;
  });

  let attemptIndex = 0;
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
      let reserved = false;
      let usageKey = "";

      try {
        attemptIndex += 1;
        usageKey = `${meter?.workspaceId ?? "none"}:${meter?.analysisId ?? "none"}:${modelName}:${attempt.label}:${attemptIndex}`;
        reserved =
          meter == null
            ? false
            : await reserveAttempt(
                meter,
                usageKey,
                estimateTokens(instructions, prompt, maxOutputTokens),
              );

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
            frequencyPenalty,
            instructions,
            maxOutputTokens,
            model: google(modelName),
            output: ai.Output.object({ schema: outputSchema }),
            presencePenalty,
            prompt,
            providerOptions,
            stopSequences,
            stopWhen: activeTools != null ? ai.isStepCount(stepCount) : undefined,
            telemetry: {
              functionId: `gen-${taskType}`,
            },
            temperature: finalTemperature,
            timeout: { stepMs: LLM_API_TIMEOUT_MS },
            tools: activeTools,
            topK: finalTopK,
            topP: finalTopP,
          });

          taskLogger.success(
            `AI (${String(attemptMetadata.phase ?? taskType)}): responded successfully.`,
          );
          await settleAttempt(meter, usageKey, modelName, result.usage);
          return result.output;
        }

        if (!stream) {
          const activeTools = attempt.useTools ? tools : undefined;
          const result = await tracedAi.generateText({
            frequencyPenalty,
            instructions,
            maxOutputTokens,
            model: google(modelName),
            presencePenalty,
            prompt,
            providerOptions,
            stopSequences,
            stopWhen: activeTools != null ? ai.isStepCount(stepCount) : undefined,
            telemetry: {
              functionId: `gen-text-${taskType}`,
            },
            temperature: finalTemperature,
            timeout: { stepMs: LLM_API_TIMEOUT_MS },
            tools: activeTools,
            topK: finalTopK,
            topP: finalTopP,
          });

          taskLogger.success(
            `AI Text (${String(attemptMetadata.phase ?? taskType)}): generated successfully.`,
          );
          await settleAttempt(meter, usageKey, modelName, result.usage);
          // Irreducible: `T` is the same parameter the structured branch resolves via `outputSchema`, which the compiler cannot check when a caller passes null.
          return result.text as unknown as T;
        }

        const activeTools = attempt.useTools ? tools : undefined;
        const result = tracedAi.streamText({
          frequencyPenalty,
          instructions,
          maxOutputTokens,
          model: google(modelName),
          presencePenalty,
          prompt,
          providerOptions,
          stopSequences,
          stopWhen: activeTools != null ? ai.isStepCount(stepCount) : undefined,
          telemetry: {
            functionId: `stream-${taskType}`,
          },
          temperature: finalTemperature,
          timeout: { stepMs: LLM_API_TIMEOUT_MS },
          tools: activeTools,
          topK: finalTopK,
          topP: finalTopP,
        });

        let finalUsage: MeterUsage | null = null;
        let fullText = "";
        let streamError: unknown = null;
        let chunkBuffer = "";
        const { aiChunks, aiThoughts, taskLogs } = TRIGGER_CONFIG.metadataKeys;
        const flushChunkBuffer = () => {
          if (chunkBuffer.length === 0) {
            return;
          }
          try {
            metadata.append(aiChunks, chunkBuffer);
          } catch (error) {
            appLogger.debug({ error: error, msg: "Metadata append failed for text-delta" });
          }
          chunkBuffer = "";
        };

        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            fullText += part.text;
            chunkBuffer += part.text;
            if (chunkBuffer.length >= 128) {
              flushChunkBuffer();
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
              metadata.append(
                taskLogs,
                `error:::${timestamp}:::AI Stream Error: ${String(part.error)}`,
              );
            } catch (error) {
              appLogger.debug({ error: error, msg: "Metadata append failed for error log" });
            }
            appLogger.error({ error: part.error, msg: "Stream event error" });
            streamError = part.error ?? new Error("Unknown stream error");
          }

          if (part.type === "finish") {
            finalUsage = part.totalUsage;
            flushChunkBuffer();
            appLogger.info({
              finishReason: part.finishReason,
              msg: `Model stream finished (${taskType}).`,
              taskType,
              totalUsage: part.totalUsage,
              ...attemptMetadata,
            });
            break;
          }

          if (part.type === "error") {
            flushChunkBuffer();
            break;
          }
        }

        flushChunkBuffer();
        if (streamError != null) {
          throw streamError instanceof Error ? streamError : new Error(String(streamError));
        }

        taskLogger.success(`AI: finished generation.`);
        await settleAttempt(meter, usageKey, modelName, finalUsage);
        // Same caller's-assertion situation as the non-streaming text branch.
        return fullText as T;
      } catch (error) {
        lastError = error;

        if (reserved) {
          await releaseAttempt(meter, usageKey);
        }

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
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  if (lastError != null) {
    throw new Error(String(lastError));
  }
  throw new Error("All models failed");
}
