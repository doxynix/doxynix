import { env } from "./env";

export const NODE_ENV = env.NODE_ENV;
export const PORT = env.PORT;
export const API_PREFIX = env.API_PREFIX;
export const TURNSTILE_SITE_KEY = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const IS_DEV = env.NODE_ENV === "development";
export const IS_PROD = env.NODE_ENV === "production";
export const IS_TEST = env.NODE_ENV === "test";
export const IS_CI = env.CI === "true";
export const IS_ANALYZE = env.ANALYZE === "true";

export const APP_URL =
  env.NEXT_PUBLIC_APP_URL ?? (IS_DEV ? "http://localhost:3000" : "https://doxynix.space");
