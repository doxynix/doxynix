import "server-only";

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4-mini";

import { envShared, isSharedValidationSkipped, sharedSchema } from "./env.shared";

export const envServer = createEnv({
  runtimeEnv: {
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    APP_VERSION: process.env.APP_VERSION,
    BETTERSTACK_API_TOKEN: process.env.BETTERSTACK_API_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_SYSTEM_INSTALLATION_ID: process.env.GITHUB_SYSTEM_INSTALLATION_ID,
    GITHUB_SYSTEM_PAT: process.env.GITHUB_SYSTEM_PAT,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    GITLAB_CLIENT_SECRET: process.env.GITLAB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    REDIS_TCP_URL: process.env.REDIS_TCP_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    YANDEX_CLIENT_ID: process.env.YANDEX_CLIENT_ID,
    YANDEX_CLIENT_SECRET: process.env.YANDEX_CLIENT_SECRET,
    ...envShared,
  },

  server: {
    ABLY_API_KEY: z.string().check(z.minLength(1)),
    APP_VERSION: z.string().check(z.minLength(1)),
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
    GITLAB_CLIENT_SECRET: z.string().check(z.minLength(1)),
    GOOGLE_CLIENT_ID: z.string().check(z.minLength(1)),
    GOOGLE_CLIENT_SECRET: z.string().check(z.minLength(1)),
    GROQ_API_KEY: z.string().check(z.minLength(1)),
    NEXTAUTH_SECRET: z.string().check(z.minLength(1)),
    REDIS_TCP_URL: z.string().check(z.minLength(1)),
    RESEND_API_KEY: z.string().check(z.minLength(1)),
    TURNSTILE_SECRET_KEY: z.string().check(z.minLength(1)),
    UPLOADTHING_TOKEN: z.string().check(z.minLength(1)),
    YANDEX_CLIENT_ID: z.string().check(z.minLength(1)),
    YANDEX_CLIENT_SECRET: z.string().check(z.minLength(1)),
  },

  shared: sharedSchema,

  skipValidation: isSharedValidationSkipped,
});

export const NEXTAUTH_SECRET = envServer.NEXTAUTH_SECRET;
export const DATABASE_URL = envServer.DATABASE_URL;
export const REDIS_TCP_URL = envServer.REDIS_TCP_URL;
export const BETTERSTACK_TOKEN = envServer.BETTERSTACK_API_TOKEN;
export const TURNSTILE_SECRET_KEY = envServer.TURNSTILE_SECRET_KEY;
export const RESEND_API_KEY = envServer.RESEND_API_KEY;
export const APP_VERSION = envServer.APP_VERSION;
export const ABLY_API_KEY = envServer.ABLY_API_KEY;
export const GROQ_API_KEY = envServer.GROQ_API_KEY;
export const UPLOADTHING_TOKEN = envServer.UPLOADTHING_TOKEN;
export const GITHUB_APP_ID = envServer.GITHUB_APP_ID;
const rawGithubAppPrivateKey = envServer.GITHUB_APP_PRIVATE_KEY;

if (envServer.NODE_ENV !== "test" && typeof rawGithubAppPrivateKey !== "string") {
  throw new Error("GITHUB_APP_PRIVATE_KEY is required and must be a valid PEM string");
}

export const GITHUB_APP_PRIVATE_KEY =
  typeof rawGithubAppPrivateKey === "string" ? rawGithubAppPrivateKey.replaceAll("\\n", "\n") : "";
export const GITHUB_SYSTEM_PAT = envServer.GITHUB_SYSTEM_PAT ?? null;
export const GITHUB_WEBHOOK_SECRET = envServer.GITHUB_WEBHOOK_SECRET;
export const GITHUB_SYSTEM_INSTALLATION_ID = envServer.GITHUB_SYSTEM_INSTALLATION_ID;

export const AUTH_PROVIDERS = {
  github: {
    id: envServer.GITHUB_CLIENT_ID,
    secret: envServer.GITHUB_CLIENT_SECRET,
  },
  google: {
    id: envServer.GOOGLE_CLIENT_ID,
    secret: envServer.GOOGLE_CLIENT_SECRET,
  },
  yandex: {
    id: envServer.YANDEX_CLIENT_ID,
    secret: envServer.YANDEX_CLIENT_SECRET,
  },
};
