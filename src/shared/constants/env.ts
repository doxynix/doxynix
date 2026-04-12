import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4-mini";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_API_PREFIX: z
      .string()
      .check(z.startsWith("/"), z.regex(/^\/[\w/\-]*$/, "Invalid prefix format")),
    NEXT_PUBLIC_APP_URL: z.optional(z.url()),
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
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    ANALYZE: process.env.ANALYZE,
    BETTERSTACK_API_TOKEN: process.env.BETTERSTACK_API_TOKEN,
    CI: process.env.CI,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_SYSTEM_INSTALLATION_ID: process.env.GITHUB_SYSTEM_INSTALLATION_ID,
    GITHUB_SYSTEM_PAT: process.env.GITHUB_SYSTEM_PAT,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    GITLAB_CLIENT_ID: process.env.GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET: process.env.GITLAB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    NEXT_PUBLIC_API_PREFIX: process.env.NEXT_PUBLIC_API_PREFIX,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TRPC_PREFIX: process.env.NEXT_PUBLIC_TRPC_PREFIX,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    YANDEX_CLIENT_ID: process.env.YANDEX_CLIENT_ID,
    YANDEX_CLIENT_SECRET: process.env.YANDEX_CLIENT_SECRET,
  },

  server: {
    ABLY_API_KEY: z.string().check(z.minLength(1)),
    BETTERSTACK_API_TOKEN: z.string().check(z.minLength(1)),
    DATABASE_URL: z.url(),

    GITHUB_APP_ID: z.string().check(z.regex(/^\d+$/, "must be numeric")),
    GITHUB_APP_PRIVATE_KEY: z
      .string()
      .check(z.regex(/BEGIN .*PRIVATE KEY/), z.regex(/END .*PRIVATE KEY/)),
    GITHUB_CLIENT_ID: z.string().check(z.minLength(1)),
    GITHUB_CLIENT_SECRET: z.string().check(z.minLength(1)),
    GITHUB_SYSTEM_INSTALLATION_ID: z.string().check(z.regex(/^\d+$/)),
    GITHUB_SYSTEM_PAT: z.optional(z.string().check(z.minLength(1))),
    GITHUB_WEBHOOK_SECRET: z.string().check(z.minLength(1)),
    GITLAB_CLIENT_ID: z.string().check(z.minLength(1)),
    GITLAB_CLIENT_SECRET: z.string().check(z.minLength(1)),
    GOOGLE_CLIENT_ID: z.string().check(z.minLength(1)),
    GOOGLE_CLIENT_SECRET: z.string().check(z.minLength(1)),
    GROQ_API_KEY: z.string().check(z.minLength(1)),
    JWT_SECRET: z.string().check(z.minLength(1)),
    NEXTAUTH_SECRET: z.string().check(z.minLength(1)),
    RESEND_API_KEY: z.string().check(z.minLength(1)),
    TURNSTILE_SECRET_KEY: z.string().check(z.minLength(1)),
    UPLOADTHING_TOKEN: z.string().check(z.minLength(1)),
    YANDEX_CLIENT_ID: z.string().check(z.minLength(1)),
    YANDEX_CLIENT_SECRET: z.string().check(z.minLength(1)),
  },

  shared: {
    ANALYZE: z.optional(z.enum(["true", "false"])),
    CI: z.optional(z.enum(["true", "false"])),
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.optional(z.string()),
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "development" ||
    (process.env.CI != null && process.env.CI !== ""),
});
