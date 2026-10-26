import type { SaveOnboardingIdentityInput } from "@doxynix/shared";
import { getOnboardingState } from "@prisma/client/sql";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";
import { trackServerEvent } from "@/server/core/posthog-events";
import { realtimeService } from "@/server/core/realtime";

import { resolveOnboardingStep } from "./onboarding.logic";
import { type OnboardingState, OnboardingStateSchema } from "./onboarding.schemas";

export const onboardingService = {
  async completeOnboarding(
    db: DbClient,
    userId: string,
    skipped: boolean,
  ): Promise<{ success: true }> {
    const user = await db.user.findUnique({
      select: {
        onboardingCompletedAt: true,
        onboardingIntent: true,
      },
      where: { id: userId },
    });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (user.onboardingCompletedAt != null) {
      return { success: true };
    }

    await db.user.update({
      data: { onboardingCompletedAt: new Date() },
      where: { id: userId },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.userUpdated, {});
    trackServerEvent(
      skipped ? "onboarding_skipped" : "onboarding_completed",
      { intent: user.onboardingIntent },
      userId,
    );

    return { success: true };
  },

  async getOnboardingState(db: DbClient, userId: string): Promise<OnboardingState> {
    const [row] = await db.$queryRawTyped(getOnboardingState(userId));

    if (row == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const hasGithubInstallation = row.hasGithubInstallation === true;

    return OnboardingStateSchema.parse({
      activatedAt: row.activatedAt,
      checklistDismissedAt: row.checklistDismissedAt,
      completedAt: row.completedAt,
      firstRepo: row.firstRepo,
      hasCompletedAnalysis: row.hasCompletedAnalysis === true,
      hasGithubAccount: row.hasGithubAccount === true,
      hasGithubInstallation,
      intent: row.intent,
      latestAnalysis: row.latestAnalysis,
      repoCount: row.repoCount ?? 0,
      step: resolveOnboardingStep({
        hasGithubInstallation,
        intent: row.intent,
      }),
    });
  },

  async saveOnboardingIdentity(
    db: DbClient,
    userId: string,
    input: SaveOnboardingIdentityInput,
  ): Promise<{ success: true }> {
    await db.user.update({
      data: {
        name: input.name,
        onboardingIntent: input.intent,
      },
      where: { id: userId },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.userUpdated, {});

    return { success: true };
  },

  async setOnboardingChecklistCollapsed(
    db: DbClient,
    userId: string,
    collapsed: boolean,
  ): Promise<{ success: true }> {
    await db.user.update({
      data: {
        onboardingChecklistDismissedAt: collapsed ? new Date() : null,
      },
      where: { id: userId },
    });

    return { success: true };
  },
};
