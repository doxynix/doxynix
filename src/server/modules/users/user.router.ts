import { TRPCError } from "@trpc/server";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";

import { appLogger } from "@/server/shared/infrastructure/app-logger";
import { prisma } from "@/server/shared/infrastructure/db";
import { UserSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../../api/contracts";
import { createTRPCRouter, protectedProcedure } from "../../api/trpc";

const utapi = new UTApi();

const PublicUserSchema = UserSchema.extend({
  id: z.uuid(),
});

export const userRouter = createTRPCRouter({
  deleteAccount: protectedProcedure
    .meta({
      openapi: {
        description: "Permanently deletes the current user account and all associated data.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/users/me",
        protect: true,
        summary: "Delete account",
        tags: ["users"],
      },
    })
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
        utapi.deleteFiles(user.imageKey).catch((error) => {
          appLogger.error({ error: error, msg: "Failed to delete avatar on account deletion" });
        });
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
              userId_provider: {
                provider: input.provider,
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

          const hasEmailAuth = user?.email != null && user.emailVerified != null;

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
              userId_provider: {
                provider: input.provider,
                userId,
              },
            },
          });
        },
        {
          isolationLevel: "Serializable",
        }
      );

      return { success: true };
    }),

  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);

    const [accounts, user] = await Promise.all([
      ctx.db.account.findMany({
        orderBy: { provider: "asc" },
        select: {
          email: true,
          image: true,
          name: true,
          provider: true,
          providerAccountId: true,
        },
        where: { userId },
      }),
      ctx.db.user.findUnique({
        select: { email: true, emailVerified: true },
        where: { id: userId },
      }),
    ]);

    return { accounts, user };
  }),

  me: protectedProcedure
    .meta({
      openapi: {
        description: "Returns detailed profile information for the currently authenticated user.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/users/me",
        protect: true,
        summary: "Get current profile",
        tags: ["users"],
      },
    })
    .input(z.object({}).optional())
    .output(z.object({ message: z.string(), user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: Number(ctx.session.user.id) },
      });

      if (user == null) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

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
    .meta({
      openapi: {
        description: "Deletes the avatar image and remove from UT.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/users/me/avatar",
        protect: true,
        summary: "Remove avatar",
        tags: ["users"],
      },
    })
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
        utapi.deleteFiles(keyToDelete).catch((error) => {
          appLogger.error({
            error: error instanceof Error ? error.message : String(error),
            keyToDelete,
            msg: "Failed to delete avatar from UT during removal",
            userId,
          });
        });
      }

      return { message: "Profile Picture removed", success: true };
    }),

  updateUser: protectedProcedure
    .meta({
      openapi: {
        errorResponses: OpenApiErrorResponses,
        method: "PATCH",
        path: "/users/me",
        protect: true,
        summary: "Update user profile",
        tags: ["users"],
      },
    })
    .input(UpdateProfileSchema)
    .output(z.object({ message: z.string(), user: PublicUserSchema }))
    .mutation(async ({ ctx, input }) => {
      const updatedUser = await ctx.db.user.update({
        data: {
          // email: input.email,
          name: input.name,
        },
        where: { id: Number(ctx.session.user.id) },
      });

      return {
        message: "Credentials updated",
        user: {
          ...updatedUser,
          id: updatedUser.publicId,
        },
      };
    }),
});
