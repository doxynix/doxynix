import Bottleneck from "bottleneck";
import Redis from "ioredis";

import { IS_PROD } from "@/shared/constants/env.flags";
import { REDIS_TCP_URL } from "@/shared/constants/env.server";

import { appLogger } from "@/server/core/app-logger";

const WRITER_JOB_EXPIRATION_MS = 4 * 60 * 1000;

const redisClient = IS_PROD
  ? new Redis(REDIS_TCP_URL, {
      connectTimeout: 10_000,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    })
  : null;

const connection =
  redisClient == null
    ? undefined
    : new Bottleneck.IORedisConnection({
        client: redisClient,
      });

const rpmLimiter = new Bottleneck({
  connection,
  datastore: connection == null ? "local" : "ioredis",
  id: "llm-rpm-limiter",
  maxConcurrent: 1,
  minTime: 60_000,
});

const tpmLimiter = new Bottleneck({
  connection,
  datastore: connection == null ? "local" : "ioredis",
  id: "llm-tpm-limiter",
  maxConcurrent: null,
  reservoir: 150_000,
  reservoirRefreshAmount: 150_000,
  reservoirRefreshInterval: 60 * 1000,
});

[rpmLimiter, tpmLimiter].forEach((l) => {
  l.on("error", (error) => appLogger.error({ error, msg: `Bottleneck Error [${l.id}]` }));
});

redisClient?.on("error", (error) => appLogger.error({ error, msg: "Redis Client Error" }));
connection?.on("error", (error) =>
  appLogger.error({ error, msg: "Bottleneck Redis Connection Error" })
);

/**
 * Единый интерфейс лимитера.
 */
export const llmLimiter = {
  schedule: async <T>(
    options: { id: string; weight: number },
    task: () => Promise<T>
  ): Promise<T> => {
    const requestId = `${options.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return rpmLimiter.schedule(
      { expiration: WRITER_JOB_EXPIRATION_MS, id: `${requestId}:rpm` },
      async () =>
        tpmLimiter.schedule(
          {
            ...options,
            expiration: WRITER_JOB_EXPIRATION_MS,
            id: `${requestId}:tpm`,
          },
          async () => {
            appLogger.info({
              baseRequestId: options.id,
              limiterMode: connection == null ? "local" : "redis",
              msg: "LLM request admitted by limiter",
              requestId,
              weight: options.weight,
            });
            return task();
          }
        )
    );
  },
};
