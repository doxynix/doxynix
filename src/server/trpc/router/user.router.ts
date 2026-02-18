import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { UTApi } from "uploadthing/server";
import z from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";
import { logger } from "@/shared/lib/logger";

import { UserSchema } from "@/generated/zod";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

const utapi = new UTApi();

export const PublicUserSchema = UserSchema.extend({
  id: z.string(),
}).omit({
  publicId: true,
  imageKey: true,
});

export const userRouter = createTRPCRouter({
  me: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/users/me",
        tags: ["users"],
        summary: "Get current profile",
        description: "Returns detailed profile information for the currently authenticated user.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(z.object({ user: PublicUserSchema, message: z.string() }))
    .query(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (user === null) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      return {
        user: {
          id: user.publicId,
          role: user.role,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        message: "User found",
      };
    }),
  updateAvatar: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/users/me/avatar",
        tags: ["users"],
        summary: "Update avatar",
        description: "Updates the avatar image URL and storage key for the current user.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      z.object({
        url: z.url().max(500),
        key: z.string().min(1).max(100),
      })
    )
    .output(
      z.object({
        image: z.string().nullish(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      const existingKeyOwner = await ctx.prisma.user.findFirst({
        where: {
          imageKey: input.key,
          NOT: { id: userId },
        },
        select: { id: true },
      });

      if (existingKeyOwner !== null) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This file key is already in use by another user",
        });
      }

      // NOTE: используется чистая призма
      const currentUser = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { imageKey: true },
      });

      const oldKey = currentUser?.imageKey;

      try {
        const updatedUser = await ctx.db.user.update({
          where: { id: userId },
          data: {
            image: input.url,
            imageKey: input.key,
          },
        });

        if (oldKey !== undefined && oldKey !== null && oldKey !== input.key) {
          utapi.deleteFiles(oldKey).catch((e) => {
            logger.error({
              msg: "Failed to delete old file from UploadThing",
              userId,
              error: e instanceof Error ? e.message : String(e),
              oldKey,
            });
          });
        }

        return {
          image: updatedUser?.image ?? null,
          message: "Profile Picture updated",
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Critical error: this file key was claimed by another request",
          });
        }
        throw error;
      }
    }),
  removeAvatar: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/users/me/avatar",
        tags: ["users"],
        summary: "Remove avatar",
        description: "Deletes the avatar image and remove from UT.",
        protect: true,
      },
    })
    .input(z.void())
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);

      // NOTE: используется чистая призма
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { imageKey: true },
      });

      const keyToDelete = user?.imageKey;

      await ctx.db.user.update({
        where: { id: userId },
        data: {
          image: null,
          imageKey: null,
        },
      });

      if (keyToDelete !== null && keyToDelete !== undefined) {
        utapi.deleteFiles(keyToDelete).catch((error) => {
          logger.error({
            msg: "Failed to delete avatar from UT during removal",
            userId,
            keyToDelete,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      return { success: true, message: "Profile Picture removed" };
    }),
  updateUser: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: "/users/me",
        tags: ["users"],
        summary: "Update user profile",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(UpdateProfileSchema)
    .output(z.object({ user: PublicUserSchema, message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      const updatedUser = await ctx.db.user.update({
        where: { id: userId },
        data: {
          name: input.name,
          email: input.email,
        },
      });

      return {
        user: {
          ...updatedUser,
          id: updatedUser.publicId,
        },
        message: "Credentials updated",
      };
    }),

  deleteAccount: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/users/me",
        tags: ["users"],
        summary: "Delete account",
        description: "Permanently deletes the current user account and all associated data.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx }) => {
      const userId = Number(ctx.session.user.id);
      // NOTE: используется чистая призма
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { imageKey: true },
      });

      if (user === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await ctx.db.user.delete({
        where: { id: userId },
      });

      if (user.imageKey !== undefined && user.imageKey !== null) {
        utapi.deleteFiles(user.imageKey).catch((e) => {
          logger.error({ msg: "Failed to delete avatar on account deletion", error: e });
        });
      }

      return {
        success: true,
        message: "Your account and all associated data have been permanently deleted",
      };
    }),
});
