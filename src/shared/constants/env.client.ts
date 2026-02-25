import { env } from "./env";

const normalizePrefix = (value: string | undefined): `/${string}` => {
  if (value == null) {
    return "/" as `/${string}`;
  }
  return (value.startsWith("/") ? value : `/${value}`) as `/${string}`;
};

export const NODE_ENV = env.NODE_ENV;
export const PORT = env.PORT;
export const API_PREFIX = normalizePrefix(env.NEXT_PUBLIC_API_PREFIX);
export const TRPC_PREFIX = normalizePrefix(env.NEXT_PUBLIC_TRPC_PREFIX);

export const TURNSTILE_SITE_KEY = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const IS_DEV = env.NODE_ENV === "development";
export const IS_PROD = env.NODE_ENV === "production";
export const IS_TEST = env.NODE_ENV === "test";
export const IS_CI = env.CI === "true";
export const IS_ANALYZE = env.ANALYZE === "true";

export const APP_URL =
  env.NEXT_PUBLIC_APP_URL ?? (IS_DEV ? "http://localhost:3000" : "https://doxynix.space");

export const SENTRY_DSN = env.NEXT_PUBLIC_SENTRY_DSN;
export const NEXT_PUBLIC_POSTHOG_KEY = env.NEXT_PUBLIC_POSTHOG_KEY;
export const NEXT_PUBLIC_POSTHOG_HOST = env.NEXT_PUBLIC_POSTHOG_HOST;
