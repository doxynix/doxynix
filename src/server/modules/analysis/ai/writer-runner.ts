import { appLogger } from "@/server/core/app-logger";
import { llmLimiter } from "@/server/utils/llm-limiter";

import type { WriterName, WriterResult } from "./writer-tasks";

export interface WriterInput {
  allowedPaths: string;
  analysisId: string;
  branch: string;
  context: string;
  engineeringDossierPayload: string;
  language: string;
  payload: string;
  repoId: string;
  selectedTokens: number;
  userId: number;
}

const WRITER_TIMEOUT_MS = 12 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 60_000)} minutes`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/**
 * Runs a documentation writer through the shared LLM rate limiter.
 * Used inline from analyze-repo (avoids batch.triggerByTaskAndWait parent hang).
 */
export async function runWriterWithLimiter(
  name: WriterName,
  input: WriterInput,
  taskFn: () => Promise<WriterResult>
): Promise<WriterResult> {
  const { analysisId, selectedTokens } = input;
  const estimatedWeight = Math.ceil(selectedTokens * 1.3) + 15_000;

  appLogger.info({
    analysisId,
    calculatedWeight: estimatedWeight,
    msg: `Running writer ${name.toUpperCase()}`,
    tokens: selectedTokens,
  });

  try {
    return await withTimeout(
      llmLimiter.schedule(
        {
          id: `${analysisId}-${name}`,
          weight: estimatedWeight,
        },
        taskFn
      ),
      WRITER_TIMEOUT_MS,
      `Writer ${name}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appLogger.error({ analysisId, error, msg: `Writer ${name} failed`, writer: name });
    return {
      error: message,
      name,
      status: "failed",
    };
  }
}
