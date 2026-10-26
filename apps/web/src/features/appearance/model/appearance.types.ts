import type { AppearancePreferences } from "@/shared/lib/appearance-preferences";

export type AppearanceSectionProps = {
  preferences: AppearancePreferences;
  update: (patch: Partial<AppearancePreferences>) => void;
};
