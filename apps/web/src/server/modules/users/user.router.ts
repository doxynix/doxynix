import { PublicUserSchema, UpdateProfileSchema } from "@doxynix/shared";
import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { userService } from "./user.service";

export const userRouter = createTRPCRouter({
  deleteAccount: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return userService.deleteAccount(ctx.db, ctx.session.user.id);
    }),

  disconnectAccount: protectedProcedure
    .input(z.object({ provider: z.enum(["github", "google", "yandex"]) }))
    .mutation(async ({ ctx, input }) => {
      return userService.disconnectAccount(ctx.db, ctx.session.user.id, input.provider);
    }),

  getActiveSessions: protectedProcedure.query(async ({ ctx }) => {
    return userService.getActiveSessions(ctx.req.headers, ctx.session.session.id === "api-key");
  }),

  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    return userService.getLinkedAccounts(ctx.db, ctx.session.user.id);
  }),

  me: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ user: PublicUserSchema }))
    .query(async ({ ctx }) => {
      return userService.getMe(ctx.db, ctx.session.user.id);
    }),

  removeAvatar: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return userService.removeAvatar(ctx.db, ctx.session.user.id);
    }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(255) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return userService.revokeSession(ctx.req.headers, input.sessionId);
    }),

  updateUser: protectedProcedure
    .input(UpdateProfileSchema)
    .output(z.object({ user: PublicUserSchema }))
    .mutation(async ({ ctx, input }) => {
      return userService.updateUser(ctx.db, ctx.session.user.id, input);
    }),
});
