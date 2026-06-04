import { Ratelimit } from "@upstash/ratelimit";

import { appLogger } from "@/server/core/app-logger";
import { redisClient } from "@/server/core/redis";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const llmTpmLimiter = new Ratelimit({
  analytics: false,
  limiter: Ratelimit.slidingWindow(230_000, "60 s"),
  prefix: "@doxynix/ratelimit/llm-tpm",
  redis: redisClient,
  timeout: 3000,
});

/**
 * Парсит сообщение об ошибке от Google Gemini API для извлечения точного времени задержки
 */
function parseGoogleRetryAfter(error: unknown): null | number {
  if (error == null) return null;

  // Безопасно извлекаем строку сообщения об ошибке
  let errorMessage = "";
  if (typeof error === "string") {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "object" && "message" in error) {
    errorMessage = String((error as Record<string, unknown>).message);
  }

  const match =
    /retry(?:ing)? in ([\d.]+)s/i.exec(errorMessage) ||
    /retry(?:ing)? after ([\d.]+)s/i.exec(errorMessage);

  if (match != null) {
    const capturedValue = match[1];
    if (capturedValue == null) return null;

    const seconds = Number.parseFloat(capturedValue);
    if (!Number.isNaN(seconds)) {
      return Math.ceil(seconds * 1000);
    }
  }

  // Проверка заголовков retry-after, если ошибка является объектом
  if (
    typeof error === "object" &&
    "status" in error &&
    (error as Record<string, unknown>).status === 429 &&
    "headers" in error
  ) {
    const headers = (error as Record<string, unknown>).headers;
    let retryHeader: null | string | undefined = null;

    if (headers != null && typeof headers === "object") {
      const getter = (headers as { get?: unknown }).get;
      if (typeof getter === "function") {
        retryHeader = (getter as (name: string) => null | string).call(headers, "retry-after");
      } else {
        retryHeader = (headers as Record<string, unknown>)["retry-after"] as string | undefined;
      }
    }

    if (retryHeader != null) {
      const seconds = Number.parseFloat(retryHeader);
      if (!Number.isNaN(seconds)) {
        return Math.ceil(seconds * 1000);
      }
    }
  }

  return null;
}

/**
 * Единый интерфейс лимитера
 */
export const llmLimiter = {
  schedule: async <T>(
    options: { id: string; weight: number },
    task: () => Promise<T>
  ): Promise<T> => {
    if (!Number.isFinite(options.weight) || options.weight <= 0) {
      throw new Error("Invalid LLM request weight: must be a positive finite number");
    }

    const capacity = 230_000;
    const requestWeight = Math.min(options.weight, capacity);
    const requestId = `${options.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const MAX_ATTEMPTS = 15;

    let consecutiveErrors = 0;
    let isAllowed = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { reset, success } = await llmTpmLimiter.limit("global-llm-tpm", {
          rate: requestWeight,
        });

        consecutiveErrors = 0;

        if (success) {
          if (attempt > 1) {
            appLogger.info({
              baseRequestId: options.id,
              msg: `LLM request admitted after ${attempt} rate-limiting attempts`,
              requestId,
              weight: options.weight,
            });
          }
          isAllowed = true;
          break;
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `LLM Rate limit reached (TPM). Max retry attempts (${MAX_ATTEMPTS}) exceeded.`
          );
        }

        const baseWaitTime = Math.max(Math.min(reset - Date.now(), 30_000), 3000);
        const jitter = Math.floor(Math.random() * 4000) + 100;
        const waitTimeMs = baseWaitTime + jitter;

        appLogger.warn({
          baseRequestId: options.id,
          msg: `LLM Rate limit reached (TPM). Attempt ${attempt}/${MAX_ATTEMPTS}. Backing off for ${Math.round(waitTimeMs / 1000)}s...`,
          requestId,
          weight: options.weight,
        });

        await sleep(waitTimeMs);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Max retry attempts")) {
          throw error;
        }

        consecutiveErrors++;

        if (consecutiveErrors >= 3) {
          appLogger.warn({
            baseRequestId: options.id,
            error,
            msg: `Upstash Ratelimit experienced ${consecutiveErrors} consecutive errors. Activating Fail-Open bypass to protect core task execution.`,
            requestId,
          });
          isAllowed = true;
          break;
        }

        appLogger.error({
          error,
          id: options.id,
          msg: `Upstash Ratelimit API error (Failure ${consecutiveErrors}/3). Falling back to brief delay before retry...`,
        });
        await sleep(3000);
      }
    }

    if (!isAllowed) {
      throw new Error("LLM task execution blocked: rate limiter did not authorize the request.");
    }

    try {
      return await task();
    } catch (error) {
      const err = error as Record<string, unknown>;

      const isRateLimitError =
        err.status === 429 ||
        err.statusCode === 429 ||
        (typeof err.message === "string" && err.message.includes("RESOURCE_EXHAUSTED"));

      if (isRateLimitError) {
        const googleRetryAfter = parseGoogleRetryAfter(error);
        const fallbackWaitTime = googleRetryAfter ?? 15_000;

        appLogger.warn({
          baseRequestId: options.id,
          error,
          msg: `Sync Drift: Upstash allowed the request, but Google returned 429 RESOURCE_EXHAUSTED. Retrying after parsed backoff of ${Math.round(fallbackWaitTime / 1000)}s...`,
          requestId,
        });

        await sleep(fallbackWaitTime);
        return await task();
      }
      throw error;
    }
  },
};
