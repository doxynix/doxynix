import { TRPCError } from "@trpc/server";
import { UTApi } from "uploadthing/server";
import z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";

import { logger } from "@/server/logger/logger";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { UserSchema } from "@/generated/zod";

const utapi = new UTApi();

export const PublicUserSchema = UserSchema.extend({
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
      const userId = Number(ctx.session.user.id);
      // NOTE: используется чистая призма
      const user = await ctx.prisma.user.findUnique({
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
        utapi.deleteFiles(user.imageKey).catch((e) => {
          logger.error({ error: e, msg: "Failed to delete avatar on account deletion" });
        });
      }

      return {
        message: "Your account and all associated data have been permanently deleted",
        success: true,
      };
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
      const userId = Number(ctx.session.user.id);

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
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
    .input(z.void())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);

      // NOTE: используется чистая призма
      const user = await ctx.prisma.user.findUnique({
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
          logger.error({
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
      const userId = Number(ctx.session.user.id);

      const updatedUser = await ctx.db.user.update({
        data: {
          email: input.email,
          name: input.name,
        },
        where: { id: userId },
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
