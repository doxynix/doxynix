import { env } from "@server/core/env";
import type { MiddlewareHandler } from "hono";
import Redis, { type Redis as RedisClient } from "ioredis";

interface SIEMRedisClient extends RedisClient {
  executeSlidingCounter(
    currentKey: string,
    previousKey: string,
    maxRequests: string,
    windowSec: string,
    nowSec: string,
  ): Promise<[number, number]>;
}

export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  commandTimeout: 1000,
}) as SIEMRedisClient;

redis.defineCommand("executeSlidingCounter", {
  numberOfKeys: 2,
  lua: `
    local current_key = KEYS[1]
    local previous_key = KEYS[2]
    local max_requests = tonumber(ARGV[1])
    local window_seconds = tonumber(ARGV[2])
    local now_sec = tonumber(ARGV[3])

    local prev_count = tonumber(redis.call('GET', previous_key) or '0') or 0
    local current_count = tonumber(redis.call('GET', current_key) or '0') or 0

    local time_passed_in_window = now_sec % window_seconds
    local elapsed = time_passed_in_window / window_seconds

    local weighted_prev = prev_count * (1 - elapsed)
    local estimated = weighted_prev + current_count

    if estimated >= max_requests then
      return { 0, 0 }
    end

    local new_count = redis.call('INCR', current_key)

    if new_count == 1 then
      redis.call('EXPIRE', current_key, window_seconds * 2)
    end

    local new_estimate = weighted_prev + new_count
    local remaining = math.max(0, math.floor(max_requests - new_estimate))

    return { 1, remaining }
  `,
});

type RateLimitConfig = {
  windowSec?: number;
  maxRequests?: number;
  prefix?: string;
};

export function createRateLimiter(config: RateLimitConfig = {}): MiddlewareHandler {
  const windowSec = config.windowSec ?? 60;
  const maxRequests = config.maxRequests ?? 100;
  const prefix = config.prefix ?? "siem:ratelimit";

  return async (c, next) => {
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "anonymous";

    const nowSec = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(nowSec / windowSec);
    const previousWindow = currentWindow - 1;

    const currentKey = `{${prefix}:${ip}}:${currentWindow}`;
    const previousKey = `{${prefix}:${ip}}:${previousWindow}`;

    const secondsToReset = windowSec - (nowSec % windowSec);

    try {
      const [allowed, remaining] = await redis.executeSlidingCounter(
        currentKey,
        previousKey,
        maxRequests.toString(),
        windowSec.toString(),
        nowSec.toString(),
      );

      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", secondsToReset.toString());

      if (allowed === 0) {
        return c.json(
          {
            success: false,
            error: "Too many requests",
          },
          429,
        );
      }
    } catch (error) {
      console.warn("[RateLimiter] Redis error/unreachable, failing open:", error);
    }

    return await next();
  };
}
