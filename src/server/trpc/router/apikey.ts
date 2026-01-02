import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .output(z.object({ key: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);

      const fullKey = crypto.randomBytes(32).toString("hex");
      const prefix = fullKey.slice(0, 6);
      const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");

      await ctx.prisma.apiKey.create({
        data: {
          userId,
          name: input.name,
          prefix,
          hashedKey,
        },
      });

      return { key: fullKey };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);

    const keys = await ctx.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        revoked: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return keys;
  }),

  updateName: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);

      const key = await ctx.prisma.apiKey.findUnique({ where: { id: input.id } });
      if (!key || key.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
      }

      await ctx.prisma.apiKey.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      return { success: true };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = Number(ctx.session.user.id);

      const key = await ctx.prisma.apiKey.findUnique({ where: { id: input.id } });
      if (!key || key.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
      }

      await ctx.prisma.apiKey.update({
        where: { id: input.id },
        data: { revoked: true },
      });

      return { success: true };
    }),

  touch: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await ctx.prisma.apiKey.updateMany({
      where: { id: input.id },
      data: { lastUsed: new Date() },
    });
    return { success: true };
  }),
});
