import { Ratelimit } from "@upstash/ratelimit";

import { redisClient } from "./redis";

const ephemeralCache = new Map<string, number>();

export const emailSignInLimiter = new Ratelimit({
  analytics: false,
  enableProtection: true,
  ephemeralCache: ephemeralCache,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  prefix: "@doxynix/ratelimit/email",
  redis: redisClient,
});
