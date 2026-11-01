import { MEMORY_REDIS_PORT, startMemoryRedis } from "./memory-redis";

/**
 * Stands up the in-memory Redis for the whole run. `setup-env.ts` repeats the URL so workers that
 * do not inherit this process's environment still reach the server.
 */
export default async function setup() {
  if (process.env.UPSTASH_REDIS_REST_URL != null) {
    return;
  }

  const redis = await startMemoryRedis(MEMORY_REDIS_PORT);
  process.env.UPSTASH_REDIS_REST_URL = redis.url;
  process.env.UPSTASH_REDIS_REST_TOKEN ??= "memory-redis-token";

  return async () => {
    await redis.close();
  };
}
