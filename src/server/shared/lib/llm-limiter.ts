import Bottleneck from "bottleneck";
import Redis from "ioredis";

import { REDIS_TCP_URL } from "@/shared/constants/env.server";

import { logger } from "../infrastructure/logger";

const redisClient = new Redis(REDIS_TCP_URL, {
  connectTimeout: 10_000,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

const connection = new Bottleneck.IORedisConnection({
  client: redisClient,
});

const rpmLimiter = new Bottleneck({
  connection,
  datastore: "redis",
  id: "llm-rpm-limiter",
  maxConcurrent: 1,
  minTime: 10_000,
});

const tpmLimiter = new Bottleneck({
  connection,
  datastore: "redis",
  id: "llm-tpm-limiter",
  maxConcurrent: null,
  reservoir: 150_000,
  reservoirRefreshAmount: 150_000,
  reservoirRefreshInterval: 60 * 1000,
});

[rpmLimiter, tpmLimiter].forEach((l) => {
  l.on("error", (error) => logger.error({ error, msg: `Bottleneck Error [${l.id}]` }));
});

redisClient.on("error", (error) => logger.error({ error, msg: "Redis Client Error" }));

/**
 * Единый интерфейс лимитера.
 */
export const llmLimiter = {
  schedule: async <T>(
    options: { id: string; weight: number },
    task: () => Promise<T>
  ): Promise<T> => {
    return rpmLimiter.schedule(async () => {
      return tpmLimiter.schedule(options, task);
    });
  },
};
