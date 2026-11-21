"use client";

import { useTranslations } from "next-intl";

import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { CodeThemeSection } from "./code-theme-section";
import { ColorThemeSection } from "./color-theme-section";
import { InteractionSection } from "./interaction-section";
import { ShapeSection } from "./shape-section";
import { SidebarSection } from "./sidebar-section";
import { ThemeModeSection } from "./theme-mode-section";

export function AppearanceSettings() {
  const t = useTranslations("Dashboard");
  const { preferences, update } = useAppearancePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings_appearance_title")}</CardTitle>
        <CardDescription>{t("settings_appearance_desc")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <ThemeModeSection />
        <ColorThemeSection />
        <CodeThemeSection
          preferences={preferences}
          update={update}
        />
        <ShapeSection
          preferences={preferences}
          update={update}
        />
        <InteractionSection
          preferences={preferences}
          update={update}
        />
        <SidebarSection
          preferences={preferences}
          update={update}
        />
      </CardContent>
    </Card>
  );
}
