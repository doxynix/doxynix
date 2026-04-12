import "server-only";

import { env } from "./env";

export const JWT_SECRET = env.JWT_SECRET;
export const NEXTAUTH_SECRET = env.NEXTAUTH_SECRET;
export const DATABASE_URL = env.DATABASE_URL;
export const BETTERSTACK_TOKEN = env.BETTERSTACK_API_TOKEN;
export const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;
export const RESEND_API_KEY = env.RESEND_API_KEY;
export const ABLY_API_KEY = env.ABLY_API_KEY;
export const GROQ_API_KEY = env.GROQ_API_KEY;
export const UPLOADTHING_TOKEN = env.UPLOADTHING_TOKEN;
export const GITHUB_APP_ID = env.GITHUB_APP_ID;
const rawGithubAppPrivateKey = env.GITHUB_APP_PRIVATE_KEY;

if (env.NODE_ENV !== "test" && typeof rawGithubAppPrivateKey !== "string") {
  throw new Error("GITHUB_APP_PRIVATE_KEY is required and must be a valid PEM string");
}

export const GITHUB_APP_PRIVATE_KEY =
  typeof rawGithubAppPrivateKey === "string" ? rawGithubAppPrivateKey.replaceAll("\\n", "\n") : "";
export const GITHUB_SYSTEM_PAT = env.GITHUB_SYSTEM_PAT ?? null;
export const GITHUB_WEBHOOK_SECRET = env.GITHUB_WEBHOOK_SECRET;
export const GITHUB_SYSTEM_INSTALLATION_ID = env.GITHUB_SYSTEM_INSTALLATION_ID;

export const AUTH_PROVIDERS = {
  github: {
    id: env.GITHUB_CLIENT_ID,
    secret: env.GITHUB_CLIENT_SECRET,
  },
  gitlab: {
    id: env.GITLAB_CLIENT_ID,
    secret: env.GITLAB_CLIENT_SECRET,
  },
  google: {
    id: env.GOOGLE_CLIENT_ID,
    secret: env.GOOGLE_CLIENT_SECRET,
  },
  yandex: {
    id: env.YANDEX_CLIENT_ID,
    secret: env.YANDEX_CLIENT_SECRET,
  },
};
