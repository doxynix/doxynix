import Redis from "ioredis";

import { env } from "@/core/env";

declare module "ioredis" {
  interface Redis {
    executeSlidingCounter(
      currentKey: string,
      previousKey: string,
      maxRequests: string,
      windowSec: string,
      nowSec: string,
    ): Promise<[number, number]>;
  }
}

export const redis = new Redis(env.REDIS_URL, {
  commandTimeout: 1000,
  connectTimeout: 2000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

redis.defineCommand("executeSlidingCounter", {
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
  numberOfKeys: 2,
});
