import { z } from "zod";

import { UpdateProfileSchema } from "@/shared/api/schemas/user";

import { userService } from "@/server/services/user.service";
import { UserSchema } from "@/generated/zod";

import { OpenApiErrorResponses } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
      return userService.deleteAccount(ctx.db, ctx.prisma, Number(ctx.session.user.id));
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
