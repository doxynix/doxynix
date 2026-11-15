import { MEMORY_REDIS_PORT, startMemoryRedis } from "./memory-redis";

/**
 * Stands up the in-memory Redis for the whole run. `setup-env.ts` repeats the URL so workers that
 * do not inherit this process's environment still reach the server.
 *
 * The URL is overwritten instead of honoured: CI exports a dummy Upstash host and Doppler exports a
 * real one, and either sends every command to the network — 4.2s of retries per call when it is
 * unreachable, live keys when it is not. `TEST_REAL_REDIS=1` opts out.
 */
export default async function setup() {
  if (process.env.TEST_REAL_REDIS === "1") {
    return;
  }

  const redis = await startMemoryRedis(MEMORY_REDIS_PORT);
  process.env.UPSTASH_REDIS_REST_URL = redis.url;
  process.env.UPSTASH_REDIS_REST_TOKEN ??= "memory-redis-token";

  return async () => {
    await redis.close();
  };
}
