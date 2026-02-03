export const NODE_ENV = process.env.NODE_ENV;
export const isDev = NODE_ENV === "development";
export const isProd = NODE_ENV === "production";
export const isTest = NODE_ENV === "test";
export const isCI = process.env.CI === "true";
export const isAnalyze = process.env.ANALYZE === "true";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL! || (isDev ? "http://localhost:3000" : "https://doxynix.space");
export const API_PREFIX = process.env.API_PREFIX;
export const PORT = process.env.PORT;
export const JWT_SECRET = process.env.JWT_SECRET ?? "my-awesome-secret";
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
export const BETTERSTACK_TOKEN = process.env.BETTERSTACK_API_TOKEN;
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const DATABASE_URL = process.env.DATABASE_URL;
export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const ABLY_API_KEY = process.env.ABLY_API_KEY;

export const AUTH_PROVIDERS = {
  github: {
    id: process.env.GITHUB_CLIENT_ID!,
    secret: process.env.GITHUB_CLIENT_SECRET!,
  },
  google: {
    id: process.env.GOOGLE_CLIENT_ID!,
    secret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  gitlab: {
    id: process.env.GITLAB_CLIENT_ID!,
    secret: process.env.GITLAB_CLIENT_SECRET!,
  },
  yandex: {
    id: process.env.YANDEX_CLIENT_ID!,
    secret: process.env.YANDEX_CLIENT_SECRET!,
  },
};
