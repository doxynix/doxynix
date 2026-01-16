import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { render } from "@react-email/render";
import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import GitLabProvider from "next-auth/providers/gitlab";
import GoogleProvider from "next-auth/providers/google";
import YandexProvider from "next-auth/providers/yandex";
import { Resend } from "resend";

import { AuthEmail } from "@/shared/api/auth/templates/AuthEmail";
import { prisma } from "@/shared/api/db/db";
import { logger } from "@/shared/lib/logger";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 дней
const SESSION_UPDATE_AGE = 24 * 60 * 60; // сутки
const MAGIC_LINK_MAX_AGE = 10 * 60; // 10 минут

const resend = process.env.RESEND_API_KEY != null ? new Resend(process.env.RESEND_API_KEY) : null;

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  secret: process.env.NEXTAUTH_SECRET!,
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  providers: [
    EmailProvider({
      maxAge: MAGIC_LINK_MAX_AGE,
      from: "Doxynix Auth <auth@mail.doxynix.space>",
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const user = await prisma.user.findUnique({
          where: { email: identifier },
          select: { emailVerified: true },
        });
        const { host } = new URL(url);
        const html = await render(<AuthEmail url={url} host={host} />);
        const template = {
          to: identifier,
          from: provider.from,
          subject: user?.emailVerified ? "Doxynix | Вход" : "Doxynix | Активация аккаунта",
          html,
        };

        try {
          if (resend === null) {
            logger.warn({
              msg: "Resend disabled (no API key)",
              type: "auth.email_warn",
            });
            return;
          }
          await resend.emails.send(template);

          logger.info({
            msg: "Verification email sent",
            type: "auth.email_sent",
            email: identifier,
          });
        } catch (error) {
          logger.error({
            msg: "Failed to send verification email",
            type: "auth.email_error",
            error: error instanceof Error ? error.message : String(error),
            email: identifier,
          });
          throw new Error("Failed to send verification email");
        }
      },
      secret: process.env.NEXTAUTH_SECRET!,
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "read:user user:email repo write:repo_hook read:org",
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitLabProvider({
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async session({ session, user }) {
      if (session?.user != null) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth",
    signOut: "/",
    error: "/auth/error", // реализовать страницу /auth/error
    newUser: "/welcome", // реализовать страницу /welcome
    verifyRequest: "/auth",
  },

  debug: process.env.NODE_ENV === "development",

  useSecureCookies: process.env.NODE_ENV !== "development",

  events: {
    async signIn({ user, account }) {
      logger.info({
        msg: "User signed in",
        type: "auth.signin",
        email: user.email,
        provider: account?.provider,
        userId: user.id,
      });
    },
    async signOut({ session }) {
      logger.info({
        msg: "User signed out",
        type: "auth.signout",
        email: session?.user?.email,
        userId: session?.user?.id,
      });
    },
    async createUser({ user }) {
      if (user.name == null && user.email != null) {
        const baseName = user.email.split("@")[0];
        const finalName = `${baseName}`;

        await prisma.user.update({
          where: { id: Number(user.id) },
          data: { name: finalName },
        });
        logger.info({
          msg: "New user created",
          type: "auth.register",
          email: user.email,
          name: finalName,
          userId: user.id,
        });
      }
    },
    async updateUser({ user }) {
      logger.info({
        msg: "User profile updated",
        type: "auth.user_update",
        email: user.email,
        userId: user.id,
      });
    },
    async linkAccount({ user, account }) {
      logger.info({
        msg: "External account linked",
        type: "auth.link_account",
        email: user.email,
        provider: account.provider,
        userId: user.id,
      });
    },
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
