import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";

import { userService } from "@/server/entities/user/api/user.service";
import { UserSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const PublicUserSchema = UserSchema.extend({
  id: z.string(),
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
    .input(z.void())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return userService.deleteAccount(ctx.db, ctx.prisma, Number(ctx.session.user.id));
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
    .input(z.void())
    .output(z.object({ message: z.string(), user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      return userService.getMe(ctx.db, Number(ctx.session.user.id));
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
    .input(z.void())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return userService.removeAvatar(ctx.db, ctx.prisma, Number(ctx.session.user.id));
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
      return userService.updateUser(ctx.db, Number(ctx.session.user.id), input);
    }),
});
