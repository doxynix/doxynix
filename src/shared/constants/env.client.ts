import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4-mini";

import { envShared, isSharedValidationSkipped, sharedSchema } from "./env.shared";

export const envClient = createEnv({
  client: {
    NEXT_PUBLIC_API_PREFIX: z
      .string()
      .check(z.startsWith("/"), z.regex(/^\/[\w/\-]*$/, "Invalid prefix format")),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().check(z.minLength(1)),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().check(z.minLength(1)),
    NEXT_PUBLIC_SENTRY_DSN: z.url(),
    NEXT_PUBLIC_TRPC_PREFIX: z
      .string()
      .check(z.startsWith("/"), z.regex(/^\/[\w/\-]*$/, "Invalid prefix format")),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().check(z.minLength(1)),
  },

  emptyStringAsUndefined: true,

  runtimeEnv: {
    NEXT_PUBLIC_API_PREFIX: process.env.NEXT_PUBLIC_API_PREFIX,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TRPC_PREFIX: process.env.NEXT_PUBLIC_TRPC_PREFIX,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    ...envShared,
  },

  shared: sharedSchema,

  skipValidation: isSharedValidationSkipped,
});

const normalizePrefix = (value: string | undefined): `/${string}` => {
  if (value == null) {
    return "/" as `/${string}`;
  }
  return (value.startsWith("/") ? value : `/${value}`) as `/${string}`;
};

export const NODE_ENV = envClient.NODE_ENV;
export const API_PREFIX = normalizePrefix(envClient.NEXT_PUBLIC_API_PREFIX);
export const TRPC_PREFIX = normalizePrefix(envClient.NEXT_PUBLIC_TRPC_PREFIX);

export const TURNSTILE_SITE_KEY = envClient.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const APP_URL = envClient.NEXT_PUBLIC_APP_URL;

export const SENTRY_DSN = envClient.NEXT_PUBLIC_SENTRY_DSN;
export const NEXT_PUBLIC_POSTHOG_KEY = envClient.NEXT_PUBLIC_POSTHOG_KEY;
export const NEXT_PUBLIC_POSTHOG_HOST = envClient.NEXT_PUBLIC_POSTHOG_HOST;
