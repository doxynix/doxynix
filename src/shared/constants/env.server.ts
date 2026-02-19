import "server-only";

import { env } from "./env";

export const JWT_SECRET = env.JWT_SECRET;
export const NEXTAUTH_SECRET = env.NEXTAUTH_SECRET;
export const DATABASE_URL = env.DATABASE_URL;
export const BETTERSTACK_TOKEN = env.BETTERSTACK_API_TOKEN;
export const TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;
export const RESEND_API_KEY = env.RESEND_API_KEY;
export const ABLY_API_KEY = env.ABLY_API_KEY;
export const SYSTEM_TOKEN = env.GITHUB_SYSTEM_TOKEN;
export const GROQ_API_KEY = env.GROQ_API_KEY;

export const AUTH_PROVIDERS = {
  github: {
    id: env.GITHUB_CLIENT_ID,
    secret: env.GITHUB_CLIENT_SECRET,
  },
  google: {
    id: env.GOOGLE_CLIENT_ID,
    secret: env.GOOGLE_CLIENT_SECRET,
  },
  gitlab: {
    id: env.GITLAB_CLIENT_ID,
    secret: env.GITLAB_CLIENT_SECRET,
  },
  yandex: {
    id: env.YANDEX_CLIENT_ID,
    secret: env.YANDEX_CLIENT_SECRET,
  },
};
