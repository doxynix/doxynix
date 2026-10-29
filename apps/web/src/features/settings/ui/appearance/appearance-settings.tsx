"use client";

import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";

import { CodeThemeSection } from "./code-theme-section";
import { ColorThemeSection } from "./color-theme-section";
import { InteractionSection } from "./interaction-section";
import { ShapeSection } from "./shape-section";
import { SidebarSection } from "./sidebar-section";
import { ThemeModeSection } from "./theme-mode-section";

export function AppearanceSettings() {
  const { preferences, update } = useAppearancePreferences();

  return (
    <div className="flex w-full flex-col gap-6">
      <ColorThemeSection />
      <ThemeModeSection />
      <ShapeSection
        preferences={preferences}
        update={update}
      />
      <SidebarSection
        preferences={preferences}
        update={update}
      />
      <CodeThemeSection
        preferences={preferences}
        update={update}
      />
      <InteractionSection
        preferences={preferences}
        update={update}
      />
    </div>
  );
}
