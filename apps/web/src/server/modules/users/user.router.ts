import {
  PublicUserSchema,
  SaveOnboardingIdentitySchema,
  UpdateProfileSchema,
} from "@doxynix/shared";
import * as z from "zod";

import {
  AppearancePatchSchema,
  AppearancePreferencesSchema,
} from "@/shared/lib/appearance-preferences";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { appearanceService } from "./appearance.service";
import { OnboardingStateSchema } from "./onboarding.schemas";
import { onboardingService } from "./onboarding.service";
import { userService } from "./user.service";

export const userRouter = createTRPCRouter({
  completeOnboarding: protectedProcedure
    .input(z.object({ skipped: z.boolean().optional() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return onboardingService.completeOnboarding(
        ctx.db,
        ctx.session.user.id,
        input.skipped ?? false,
      );
    }),
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
    return userService.getActiveSessions(
      ctx.db,
      ctx.session.user.id,
      ctx.session.session.id === "api-key",
    );
  }),

  getAppearance: protectedProcedure
    .input(z.object({}).optional())
    .output(AppearancePreferencesSchema.nullable())
    .query(({ ctx }) => appearanceService.getAppearance(ctx.db, ctx.session.user.id)),

  getLinkedAccounts: protectedProcedure.query(async ({ ctx }) => {
    return userService.getLinkedAccounts(ctx.db, ctx.session.user.id);
  }),

  getOnboardingState: protectedProcedure
    .input(z.object({}).optional())
    .output(OnboardingStateSchema)
    .query(async ({ ctx }) => {
      return onboardingService.getOnboardingState(ctx.db, ctx.session.user.id);
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

  revokeOtherSessions: protectedProcedure
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return userService.revokeOtherSessions(ctx.session.user.id, ctx.session.session.id);
    }),

  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(255) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return userService.revokeSession(ctx.session.user.id, input.sessionId);
    }),

  saveOnboardingIdentity: protectedProcedure
    .input(SaveOnboardingIdentitySchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return onboardingService.saveOnboardingIdentity(ctx.db, ctx.session.user.id, input);
    }),

  setOnboardingChecklistCollapsed: protectedProcedure
    .input(z.object({ collapsed: z.boolean() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return onboardingService.setOnboardingChecklistCollapsed(
        ctx.db,
        ctx.session.user.id,
        input.collapsed,
      );
    }),

  updateAppearance: protectedProcedure
    .input(AppearancePatchSchema)
    .output(AppearancePreferencesSchema)
    .mutation(({ ctx, input }) =>
      appearanceService.updateAppearance(ctx.db, ctx.session.user.id, input),
    ),

  updateUser: protectedProcedure
    .input(UpdateProfileSchema)
    .output(z.object({ user: PublicUserSchema }))
    .mutation(async ({ ctx, input }) => {
      return userService.updateUser(ctx.db, ctx.session.user.id, input);
    }),
});
