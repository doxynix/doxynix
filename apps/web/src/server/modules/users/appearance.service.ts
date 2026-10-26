import {
  type AppearancePatch,
  type AppearancePreferences,
  AppearancePreferencesSchema,
  DEFAULT_APPEARANCE,
} from "@/shared/lib/appearance-preferences";

import type { DbClient } from "@/server/core/db";

export const appearanceService = {
  async getAppearance(db: DbClient, userId: string): Promise<AppearancePreferences | null> {
    const row = await db.userAppearance.findUnique({
      select: { preferences: true },
      where: { userId },
    });

    return row == null ? null : AppearancePreferencesSchema.parse(row.preferences);
  },

  async updateAppearance(
    db: DbClient,
    userId: string,
    patch: AppearancePatch,
  ): Promise<AppearancePreferences> {
    const current = (await appearanceService.getAppearance(db, userId)) ?? DEFAULT_APPEARANCE;
    const next = AppearancePreferencesSchema.parse({ ...current, ...patch });

    await db.userAppearance.upsert({
      create: { preferences: next, userId },
      update: { preferences: next },
      where: { userId },
    });

    return next;
  },
};
