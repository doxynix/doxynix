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
  timeout: 1500,
});

export const memberAddLimiter = new Ratelimit({
  analytics: false,
  enableProtection: true,
  ephemeralCache: ephemeralCache,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
  prefix: "@doxynix/ratelimit/member-add",
  redis: redisClient,
  timeout: 1500,
});

// Analyses are expensive and metered; a burst is throttled before it reaches the queue.
export const analysisStartLimiter = new Ratelimit({
  analytics: false,
  enableProtection: true,
  ephemeralCache: ephemeralCache,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  prefix: "@doxynix/ratelimit/analysis-start",
  redis: redisClient,
  timeout: 1500,
});
