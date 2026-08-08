import { redis } from "@server/core/redis";
import { getIp } from "@server/utils/request-context";
import type { MiddlewareHandler } from "hono";

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
    const ip = getIp(c);

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
