import { TRPCError } from "@trpc/server";
import z from "zod";

import { UserRoleSchema, UserSchema } from "@/generated/zod";
import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

export const PublicUserSchema = UserSchema.extend({
  id: z.string(),
  role: UserRoleSchema,
  email: z.email().nullable(),
  name: z.string().nullable(),
  emailVerified: z.date().nullable(),
  image: z.url().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
}).omit({ publicId: true });

export const userRouter = createTRPCRouter({
  whoami: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/users/whoami",
        tags: ["user"],
        summary: "Get current user information",
        description:
          "Returns the authenticated user's profile information, including public ID, email, name, role, and other relevant account details. Accessible only to logged-in users.",

        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .output(z.object({ user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      const id = Number(ctx.session.user.id);

      const user = await ctx.prisma.user.findFirst({
        where: { id },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

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
});
