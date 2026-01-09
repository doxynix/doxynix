import { TRPCError } from "@trpc/server";
import { UTApi } from "uploadthing/server";
import z from "zod";

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
  whoami: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/users/whoami",
        tags: ["users"],
        summary: "Get current user information",
        description:
          "Returns the authenticated user's profile information, including public ID, email, name, role, and other relevant account details. Accessible only to logged-in users.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(z.object({ user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      const id = Number(ctx.session.user.id);

      const user = await ctx.db.user.findFirst({
        where: { id },
      });

      if (user === null)
        throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });

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
      };
    }),
  updateAvatar: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/users/avatar",
        tags: ["users"],
        summary: "Update avatar",
        description: "Update user avatar",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      z.object({
        url: z.string(),
        key: z.string(),
      })
    )
    .output(
      z.object({
        image: z.string().nullable(),
        imageKey: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);

      const currentUser = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { imageKey: true },
      });

      if (currentUser !== null && currentUser.imageKey !== null) {
        try {
          await utapi.deleteFiles(currentUser.imageKey);
        } catch (e) {
          console.error("Не удалось удалить старый файл из UT:", e);
        }
      }

      return await ctx.db.user.update({
        where: { id: userId },
        data: {
          image: input.url,
          imageKey: input.key,
        },
        select: {
          image: true,
          imageKey: true,
        },
      });
    }),
});
