const NODE_ENV = process.env.NODE_ENV;
const CI = process.env.CI;

export const IS_DEV = NODE_ENV === "development";
export const IS_PROD = NODE_ENV === "production";
export const IS_TEST = NODE_ENV === "test";
export const IS_CI = CI === "true";
export const IS_ANALYZE = process.env.ANALYZE === "true";
/**
 * The global rate limiter in `proxy.ts` costs a Redis round trip per request, so a slow link to
 * Upstash shows up as latency on every endpoint. `RATE_LIMIT_ENABLED=false` measures the floor
 * underneath it — the app without middleware — which is a different number from the app with it,
 * and both are worth knowing. Defaults on; there is no reason to ship it off.
 */
export const IS_RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
