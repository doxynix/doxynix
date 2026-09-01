import { TRPCError } from "@trpc/server";
import { del } from "@vercel/blob";
import { z } from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
import { UserSchema } from "@/shared/api-contracts";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";
import { formatUserAgent } from "@/server/utils/ua-parser";

const PublicUserSchema = UserSchema.extend({
  id: z.uuid(),
}).omit({
  banExpires: true,
  banned: true,
  banReason: true,
  lastLoginMethod: true,
  twoFactorEnabled: true,
});

export const userRouter = createTRPCRouter({
  deleteAccount: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);
      const user = await prisma.user.findUnique({
        select: { imageKey: true },
        where: { id: userId },
      });

      if (user == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await ctx.db.user.delete({
        where: { id: userId },
      });

      if (user.imageKey != null) {
        try {
          await del(user.imageKey);
        } catch (error) {
          appLogger.error({
            error: error instanceof Error ? error.message : String(error),
            imageKey: user.imageKey,
            msg: "Failed to delete avatar on account deletion",
            userId,
          });
        }
      }

      return {
        message: "Your account and all associated data have been permanently deleted",
        success: true,
      };
    }),

  disconnectAccount: protectedProcedure
    .input(z.object({ provider: z.enum(["github", "google", "yandex"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      await ctx.prisma.$transaction(
        async (tx) => {
          // Check if the account exists
          const accountToDelete = await tx.account.findUnique({
            where: {
              userId_providerId: {
                providerId: input.provider,
                userId,
              },
            },
          });

          if (accountToDelete == null) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Account not found or already disconnected.",
            });
          }

          // Re-validate account count and email auth within transaction
          const accountCount = await tx.account.count({
            where: { userId },
          });

          const user = await tx.user.findUnique({
            select: { email: true, emailVerified: true },
            where: { id: userId },
          });

          const hasEmailAuth = user?.email != null && user.emailVerified;

          if (accountCount <= 1 && !hasEmailAuth) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "You cannot disconnect your only authentication method. Add another one first.",
            });
          }

          // Perform the delete
          await tx.account.delete({
            where: {
              userId_providerId: {
                providerId: input.provider,
                userId,
              },
            },
          });
        },
        {
          isolationLevel: "Serializable",
        },
      );

      return { success: true };
    }),

  getActiveSessions: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);

    const sessions = await ctx.prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      where: { userId },
    });

    return sessions.map((session) => ({
      createdAt: session.createdAt,
      id: session.id,
      ipAddress: session.ipAddress,
      token: session.token,
      userAgent: formatUserAgent(session.userAgent),
    }));
  }),

  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);

    const [accounts, user] = await Promise.all([
      ctx.db.account.findMany({
        orderBy: { providerId: "asc" },
        select: {
          accountId: true,
          email: true,
          image: true,
          name: true,
          providerId: true,
        },
        where: { userId },
      }),
      ctx.db.user.findUnique({
        select: { email: true, emailVerified: true },
        where: { id: userId },
      }),
    ]);

    const mappedAccounts = accounts.map((acc) => ({
      accountId: acc.accountId,
      email: acc.email,
      image: acc.image,
      name: acc.name,
      provider: acc.providerId,
    }));

    return { accounts: mappedAccounts, user };
  }),

  me: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ message: z.string(), user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: Number(ctx.session.user.id) },
      });

      if (user == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return {
        message: "User found",
        user: {
          createdAt: user.createdAt,
          email: user.email,
          emailVerified: user.emailVerified,
          id: user.publicId,
          image: user.image,
          name: user.name,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      };
    }),

  removeAvatar: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);
      // NOTE: используется чистая призма
      const user = await prisma.user.findUnique({
        select: { imageKey: true },
        where: { id: userId },
      });

      const keyToDelete = user?.imageKey;

      await ctx.db.user.update({
        data: {
          image: null,
          imageKey: null,
        },
        where: { id: userId },
      });

      if (keyToDelete != null) {
        try {
          await del(keyToDelete);
        } catch (error) {
          appLogger.error({
            error: error instanceof Error ? error.message : String(error),
            keyToDelete,
            msg: "Failed to delete avatar from Vercel Blob during removal",
            userId,
          });
        }
      }

      return { message: "Profile Picture removed", success: true };
    }),

  updateUser: protectedProcedure
    .input(UpdateProfileSchema)
    .output(z.object({ message: z.string(), user: PublicUserSchema }))
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await ctx.db.user.update({
        data: {
          name: input.name,
        },
        where: { id: Number(ctx.session.user.id) },
      });

      return {
        message: "Credentials updated",
        user: {
          createdAt: updatedUser.createdAt,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified,
          id: updatedUser.publicId,
          image: updatedUser.image,
          name: updatedUser.name,
          role: updatedUser.role,
          updatedAt: updatedUser.updatedAt,
        },
      };
    }),
});
