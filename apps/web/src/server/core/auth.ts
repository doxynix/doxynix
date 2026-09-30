import { createElement } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { passkey } from "@better-auth/passkey";
import { render } from "@react-email/render";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin,
  captcha,
  genericOAuth,
  lastLoginMethod,
  magicLink,
  twoFactor,
} from "better-auth/plugins";
import { getTranslations } from "next-intl/server";
import { Resend } from "resend";
import * as z from "zod";

import { IS_PROD } from "@/shared/config/env.flags";
import {
  AUTH_PROVIDERS,
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  RESEND_API_KEY,
  TURNSTILE_SECRET_KEY,
} from "@/shared/config/env.server";
import { resolveRequestLocale } from "@/shared/i18n/resolve-request-locale";

import { AuthEmail } from "@/server/core/auth-email";

import { getNormalizedHash } from "../utils/hash";
import { appLogger } from "./app-logger";
import { customAuthAdapter } from "./auth/auth-adapter";
import { prisma } from "./db";
import { maskEmail, normalizeEmail, validateEmailSafety } from "./email-guard";
import { emailSignInLimiter } from "./ratelimit";
import { redisService } from "./redis";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // TIME: 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // TIME: 24 hours
const MAGIC_LINK_MAX_AGE = 10 * 60; // TIME: 10 minutes

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Unauthenticated sign-in bodies: only `email` is read, and it must be a string.
const EmailRequestBody = z.object({
  email: z.string().optional(),
});

const yandexProfileSchema = z.object({
  default_avatar_id: z.string().nullish(),
  default_email: z.string().nullish(),
  display_name: z.string().nullish(),
  id: z.union([z.string(), z.number()]),
  is_avatar_empty: z.boolean().nullish(),
  real_name: z.string().nullish(),
});

async function assertEmailNotBanned(
  dbUser: { email: null | string; emailHash: null | string; id: string },
  action: string,
): Promise<void> {
  if (dbUser.emailHash == null) {
    return;
  }

  const isBanned = await prisma.bannedEmail.findUnique({
    where: { emailHash: dbUser.emailHash },
  });

  if (isBanned == null) {
    return;
  }

  appLogger.warn({
    email: maskEmail(dbUser.email),
    msg: `Banned user tried to ${action}`,
    userId: String(dbUser.id),
  });
  throw new APIError("FORBIDDEN", { message: "EmailBanned" });
}

export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["yandex", "github"],
    },
    additionalFields: {
      email: { type: "string" },
      emailHash: { type: "string" },
      image: { type: "string" },
      name: { type: "string" },
    },
    storeStateStrategy: "cookie",
  },

  advanced: {
    backgroundTasks: {
      handler: (promise) => {
        after(() => promise);
      },
    },
    cookiePrefix: "doxynix",
    database: {
      generateId: false,
    },
    useSecureCookies: IS_PROD,
  },
  appName: "Doxynix",
  baseURL: BETTER_AUTH_URL,
  database: () => customAuthAdapter,
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          const baAccount = account as {
            image?: null | string;
            providerId?: string;
            userId: string;
          };
          const dbUser = await prisma.user.findUnique({
            where: { id: baAccount.userId },
          });

          if (dbUser != null && dbUser.image == null && baAccount.image != null) {
            await prisma.user.update({
              data: { image: baAccount.image },
              where: { id: dbUser.id },
            });
          }

          appLogger.info({
            msg: "External account linked",
            provider: baAccount.providerId,
            type: "auth.link_account",
            userId: String(baAccount.userId),
          });
        },
        before: async (account) => {
          const payload = { ...account } as Record<string, unknown>;
          const dbUser = await prisma.user.findUnique({
            where: { id: payload.userId as string },
          });

          if (dbUser != null) {
            payload.email = dbUser.email;
            payload.emailHash = dbUser.emailHash;

            payload.image ??= dbUser.image;
            payload.name ??= dbUser.name;

            const isDefaultName =
              dbUser.name == null || dbUser.name === dbUser.email?.split("@")[0];
            if (isDefaultName && payload.name != null) {
              await prisma.user.update({
                data: { name: payload.name as string },
                where: { id: dbUser.id },
              });
              appLogger.info({
                msg: "User name upgraded from social account provider profile",
                userId: String(dbUser.id),
              });
            }
          }
          return { data: payload as typeof account };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const dbUser = await prisma.user.findUnique({
            select: { createdAt: true, id: true, role: true },
            where: { id: session.userId },
          });

          if (dbUser != null) {
            const isNewUser = Date.now() - dbUser.createdAt.getTime() < 10_000;
            if (isNewUser) {
              appLogger.info({
                msg: "First time login experience triggered",
                userId: String(dbUser.id),
              });
            }

            appLogger.info({
              msg: "User signed in",
              role: dbUser.role,
              type: "auth.signin",
              userId: String(session.userId),
            });
          } else {
            appLogger.info({
              msg: "User signed in",
              type: "auth.signin",
              userId: String(session.userId),
            });
          }
        },
        before: async (session) => {
          const dbUser = await prisma.user.findUnique({
            where: { id: session.userId },
          });

          if (dbUser?.emailHash != null) {
            await assertEmailNotBanned(dbUser, "initiate a session (OAuth sign-in blocked)");

            const latestAccount = await prisma.account.findFirst({
              orderBy: { updatedAt: "desc" },
              where: { userId: dbUser.id },
            });

            if (
              latestAccount != null &&
              latestAccount.providerId !== "email" &&
              latestAccount.providerId !== "credential"
            ) {
              const freshImage = latestAccount.image;
              const freshName = latestAccount.name;

              const isDefaultName =
                dbUser.name == null || dbUser.name === dbUser.email?.split("@")[0];
              const shouldUpdateImage = freshImage != null && freshImage !== dbUser.image;
              const shouldUpdateName = freshName != null && isDefaultName;

              if (shouldUpdateImage || shouldUpdateName) {
                await prisma.user.update({
                  data: {
                    ...(shouldUpdateImage && { image: freshImage }),
                    ...(shouldUpdateName && { name: freshName }),
                  },
                  where: { id: dbUser.id },
                });
                appLogger.info({
                  msg: "User profile synchronized from OAuth provider",
                  userId: String(dbUser.id),
                });
              }
            }
          }

          return { data: session };
        },
      },
      update: {
        before: async (session) => {
          if (session.id == null) {
            return { data: session };
          }

          const dbSession = await prisma.session.findUnique({
            where: { id: session.id },
          });

          if (dbSession != null) {
            const dbUser = await prisma.user.findUnique({
              where: { id: dbSession.userId },
            });

            if (dbUser != null) {
              await assertEmailNotBanned(dbUser, "refresh session");
            }
          }

          return { data: session };
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          appLogger.info({
            email: maskEmail(user.email),
            msg: "New user created",
            name: user.name,
            type: "auth.register",
            userId: user.id,
          });
        },
        before: async (user) => {
          const payload = { ...user } as Record<string, unknown>;

          if (typeof payload.email === "string") {
            const cleanEmail = normalizeEmail(payload.email);
            const isBanned = await prisma.bannedEmail.findUnique({
              where: { emailHash: getNormalizedHash(cleanEmail) },
            });
            if (isBanned != null) {
              appLogger.warn({
                email: maskEmail(cleanEmail),
                msg: "Banned email tried to register via social OAuth",
              });
              throw new APIError("FORBIDDEN", { message: "EmailBanned" });
            }
            payload.email = cleanEmail;
          }

          if (payload.name == null && typeof payload.email === "string") {
            payload.name = payload.email.split("@")[0] ?? "User";
          }
          return { data: payload as typeof user };
        },
      },
      update: {
        after: async (user) => {
          appLogger.info({
            msg: "User profile updated",
            type: "auth.user_update",
            userId: String(user.id),
          });
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-in/email") || ctx.path.startsWith("/magic-link/send")) {
        // Parsed rather than cast: the body is unauthenticated, so a non-string `email` must not reach `normalizeEmail` unchecked.
        const body = EmailRequestBody.safeParse(ctx.body);

        if (!body.success || body.data.email == null) {
          throw new APIError("BAD_REQUEST", { message: "Email is required" });
        }

        const normalizedEmail = normalizeEmail(body.data.email);

        const isBanned = await prisma.bannedEmail.findUnique({
          where: { emailHash: getNormalizedHash(normalizedEmail) },
        });

        if (isBanned != null) {
          appLogger.warn({
            email: maskEmail(normalizedEmail),
            msg: "Banned user tried to sign in",
          });
          throw new APIError("FORBIDDEN", { message: "EmailBanned" });
        }

        const headerList = await headers();
        const ip =
          headerList.get("x-forwarded-for")?.split(",")[0] ??
          headerList.get("x-real-ip") ??
          "127.0.0.1";

        const { reason: limitReason, success } = await emailSignInLimiter.limit(
          `${normalizedEmail}:${ip}`,
          { ip },
        );
        if (!success) {
          appLogger.warn({
            email: maskEmail(normalizedEmail),
            ip,
            limitReason,
            msg: "Rate limit hit on sign in",
          });
          throw new APIError("TOO_MANY_REQUESTS", { message: "RateLimitExceeded" });
        }

        const { reason: safetyReason, safe } = await validateEmailSafety(normalizedEmail);
        if (!safe) {
          appLogger.warn({
            email: maskEmail(normalizedEmail),
            ip,
            msg: "Security guard blocked email",
            safetyReason,
          });
          throw new APIError("BAD_REQUEST", { message: "EmailRejected" });
        }
      }

      if (ctx.path === "/sign-out") {
        const session = ctx.context.session;
        appLogger.info({
          msg: "User signed out",
          type: "auth.signout",
          userId: session ? String(session.user.id) : "unknown",
        });
      }
    }),
  },

  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_MAX_AGE,
      sendMagicLink: async ({ email, url }) => {
        const cleanEmail = normalizeEmail(email);
        const { host } = new URL(url);

        try {
          if (resend == null) {
            appLogger.warn({ msg: "Resend disabled (no API key)", type: "auth.email_warn" });
            return;
          }

          const user = await prisma.user.findUnique({
            select: { emailVerified: true },
            where: { emailHash: getNormalizedHash(cleanEmail) },
          });

          const authLocale = await resolveRequestLocale();
          const t = await getTranslations({ locale: authLocale, namespace: "Auth" });
          const html = await render(createElement(AuthEmail, { host, t, url }));

          await resend.emails.send({
            from: "Doxynix Auth <auth@doxynix.space>",
            html,
            replyTo: "support@doxynix.space",
            subject:
              user?.emailVerified === true
                ? t("email_subject_login")
                : t("email_subject_activation"),
            tags: [{ name: "category", value: "authentication" }],
            to: cleanEmail,
          });

          appLogger.info({
            email: maskEmail(cleanEmail),
            msg: "Verification email sent",
            type: "auth.email_sent",
          });
        } catch (error) {
          appLogger.error({
            email: maskEmail(cleanEmail),
            error: error instanceof Error ? error.message : String(error),
            msg: "Failed to send verification email",
            type: "auth.email_error",
          });
          throw new Error("Failed to send verification email", { cause: error });
        }
      },
    }),

    captcha({
      endpoints: ["/magic-link/send", "/sign-in/email"],
      provider: "cloudflare-turnstile",
      secretKey: TURNSTILE_SECRET_KEY,
    }),

    lastLoginMethod({
      customResolveMethod: (ctx) => {
        if (ctx.path === "/magic-link/verify") {
          return "magic-link";
        }

        return null;
      },
      storeInDatabase: true,
    }),

    passkey({
      origin: IS_PROD ? "https://doxynix.space" : "http://localhost:3000",
      rpID: IS_PROD ? "doxynix.space" : "localhost",
      rpName: "Doxynix",
    }),

    admin({
      adminRoles: ["ADMIN"],
      defaultRole: "USER",
    }),

    twoFactor({
      allowPasswordless: true,
      issuer: "Doxynix",
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
    }),

    genericOAuth({
      config: [
        {
          authorizationUrl: "https://oauth.yandex.ru/authorize",
          clientId: AUTH_PROVIDERS.yandex.id,
          clientSecret: AUTH_PROVIDERS.yandex.secret,
          getUserInfo: async (token) => {
            const res = await fetch("https://login.yandex.ru/info?format=json", {
              headers: {
                Authorization: `OAuth ${token.accessToken}`,
              },
            });

            if (!res.ok) {
              appLogger.error({
                msg: "Yandex user info request failed",
                status: res.status,
              });
              throw new APIError("BAD_REQUEST", { message: "YandexUserInfoFailed" });
            }

            const parsed = yandexProfileSchema.safeParse(await res.json());

            if (!parsed.success) {
              appLogger.error({
                error: parsed.error,
                msg: "Unexpected Yandex user info shape",
              });
              throw new APIError("BAD_REQUEST", { message: "YandexUserInfoInvalid" });
            }

            const profile = parsed.data;

            return {
              email: profile.default_email ?? null,
              emailVerified: true,
              id: String(profile.id),
              image:
                profile.is_avatar_empty === true
                  ? undefined
                  : `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`,
              name: profile.real_name ?? profile.display_name ?? undefined,
            };
          },
          providerId: "yandex",
          tokenUrl: "https://oauth.yandex.ru/token",
        },
      ],
    }),
  ],

  rateLimit: {
    customRules: {
      "/magic-link/send": { max: 3, window: 60 },
      "/passkey/register": { max: 5, window: 60 },
      "/sign-in/email": { max: 5, window: 60 },
      "/sign-up/email": { max: 5, window: 60 },
      "/two-factor/verify": { max: 5, window: 30 },
    },
    enabled: IS_PROD,
    max: 100,
    storage: IS_PROD ? "secondary-storage" : "memory",
    window: 10,
  },

  secondaryStorage: redisService.authStorage,

  secret: BETTER_AUTH_SECRET,

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
      strategy: "compact",
    },
    expiresIn: SESSION_MAX_AGE,
    preserveSessionInDatabase: true,
    storeSessionInDatabase: true,
    updateAge: SESSION_UPDATE_AGE,
  },

  socialProviders: {
    github: {
      clientId: AUTH_PROVIDERS.github.id,
      clientSecret: AUTH_PROVIDERS.github.secret,
    },
  },

  telemetry: { enabled: false },

  user: {
    additionalFields: {
      role: { defaultValue: "USER", type: "string" },
    },
  },

  verification: {
    storeInDatabase: false,
  },
});

export type SessionAndUser = NonNullable<typeof auth.$Infer.Session>;
export type User = SessionAndUser["user"];
export type Session = SessionAndUser["session"];
