import { cache } from "react";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { render } from "@react-email/render";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import GitLabProvider from "next-auth/providers/gitlab";
import GoogleProvider from "next-auth/providers/google";
import YandexProvider from "next-auth/providers/yandex";
import { Resend } from "resend";

import { AuthEmail } from "@/shared/api/auth/templates/auth-email";
import { IS_DEV, IS_PROD } from "@/shared/constants/env.client";
import { AUTH_PROVIDERS, NEXTAUTH_SECRET, RESEND_API_KEY } from "@/shared/constants/env.server";

import { baseClient, prisma } from "@/server/db/db";
import { logger } from "@/server/logger/logger";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // TIME: 30 дней
const SESSION_UPDATE_AGE = 24 * 60 * 60; // TIME: сутки
const MAGIC_LINK_MAX_AGE = 10 * 60; // TIME: 10 минут

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(baseClient),
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
  debug: IS_DEV,
  events: {
    async createUser({ user }) {
      if (user.name == null && user.email != null) {
        const baseName = user.email.split("@")[0];
        const finalName = `${baseName}`;

        await prisma.user.update({
          data: { name: finalName },
          where: { id: Number(user.id) },
        });
        logger.info({
          email: user.email,
          msg: "New user created",
          name: finalName,
          type: "auth.register",
          userId: user.id,
        });
      }
    },
    async linkAccount({ account, user }) {
      logger.info({
        msg: "External account linked",
        provider: account.provider,
        type: "auth.link_account",
        userId: user.id,
      });
    },
    async signIn({ account, user }) {
      logger.info({
        msg: "User signed in",
        provider: account?.provider,
        type: "auth.signin",
        userId: user.id,
      });
    },
    async signOut({ session }) {
      logger.info({
        msg: "User signed out",
        type: "auth.signout",
        userId: session.user.id,
      });
    },
    async updateUser({ user }) {
      logger.info({
        msg: "User profile updated",
        type: "auth.user_update",
        userId: user.id,
      });
    },
  },

  pages: {
    error: "/auth/error", // TODO: Реализовать /auth/error page
    newUser: "/welcome", // TODO: Реализовать /welcome page
    signIn: "/auth",
    signOut: "/",
    verifyRequest: "/auth",
  },

  providers: [
    EmailProvider({
      from: "Doxynix Auth <auth@doxynix.space>",
      maxAge: MAGIC_LINK_MAX_AGE,
      secret: NEXTAUTH_SECRET,
      sendVerificationRequest: async ({ identifier, provider, url }) => {
        const user = await prisma.user.findUnique({
          select: { emailVerified: true },
          where: { email: identifier },
        });
        const { host } = new URL(url);
        const html = await render(<AuthEmail host={host} url={url} />);
        const template = {
          from: provider.from,
          html,
          reply_to: "support@doxynix.space",
          subject: user?.emailVerified == null ? "Doxynix | Account Activation" : "Doxynix | Login",
          tags: [
            {
              name: "category",
              value: "authentication",
            },
          ],

          to: identifier,
        };

        try {
          if (resend == null) {
            logger.warn({
              msg: "Resend disabled (no API key)",
              type: "auth.email_warn",
            });
            return;
          }
          await resend.emails.send(template);

          logger.info({
            email: identifier,
            msg: "Verification email sent",
            type: "auth.email_sent",
          });
        } catch (error) {
          logger.error({
            email: identifier,
            error: error instanceof Error ? error.message : String(error),
            msg: "Failed to send verification email",
            type: "auth.email_error",
          });
          throw new Error("Failed to send verification email");
        }
      },
    }),

    GitHubProvider({
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "read:user user:email repo write:repo_hook read:org",
        },
      },
      clientId: AUTH_PROVIDERS.github.id,
      clientSecret: AUTH_PROVIDERS.github.secret,
    }),
    GoogleProvider({
      allowDangerousEmailAccountLinking: true,
      clientId: AUTH_PROVIDERS.google.id,
      clientSecret: AUTH_PROVIDERS.google.secret,
    }),
    GitLabProvider({
      allowDangerousEmailAccountLinking: true,
      clientId: AUTH_PROVIDERS.gitlab.id,
      clientSecret: AUTH_PROVIDERS.gitlab.secret,
    }),
    YandexProvider({
      allowDangerousEmailAccountLinking: true,
      clientId: AUTH_PROVIDERS.yandex.id,
      clientSecret: AUTH_PROVIDERS.yandex.secret,
    }),
  ],

  secret: NEXTAUTH_SECRET,

  session: {
    maxAge: SESSION_MAX_AGE,
    strategy: "database",
    updateAge: SESSION_UPDATE_AGE,
  },

  useSecureCookies: IS_PROD,
};

export const getServerAuthSession = cache(() => getServerSession(authOptions));
