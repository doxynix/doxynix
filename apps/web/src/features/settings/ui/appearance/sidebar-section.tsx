"use client";

import { useTranslations } from "next-intl";

import type { SidebarVariant } from "@/shared/lib/appearance-preferences";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/core/toggle-group";

import type { AppearanceSectionProps } from "../../model/appearance/appearance.types";
import { AppearanceRow, AppearanceSection } from "./appearance-section";

export function SidebarSection({ preferences, update }: Readonly<AppearanceSectionProps>) {
  const t = useTranslations("Dashboard");

  const variantLabels: Record<SidebarVariant, string> = {
    floating: t("settings_appearance_sidebar_style_floating"),
    sidebar: t("settings_appearance_sidebar_style_sidebar"),
  };

  const collapseLabels: Record<"icon" | "offcanvas", string> = {
    icon: t("settings_appearance_sidebar_collapse_icon"),
    offcanvas: t("settings_appearance_sidebar_collapse_offcanvas"),
  };

  return (
    <AppearanceSection
      description={t("settings_appearance_sidebar_desc")}
      title={t("settings_appearance_sidebar_title")}
    >
      <div className="flex flex-col gap-4">
        <AppearanceRow
          description={t("settings_appearance_sidebar_style_desc")}
          title={t("settings_appearance_sidebar_style_label")}
        >
          <ToggleGroup
            className="inline-flex h-9 items-center rounded-lg border border-border bg-muted p-1"
            onValueChange={(variant) => {
              if (variant) {
                update({ sidebarVariant: variant as SidebarVariant });
              }
            }}
            type="single"
            value={preferences.sidebarVariant}
          >
            {(["sidebar", "floating"] as const).map((variant) => (
              <ToggleGroupItem
                aria-label={variantLabels[variant]}
                className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
                key={variant}
                value={variant}
              >
                {variantLabels[variant]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_sidebar_collapse_desc")}
          title={t("settings_appearance_sidebar_collapse_title")}
        >
          <ToggleGroup
            className="inline-flex h-9 items-center rounded-lg border border-border bg-muted p-1"
            onValueChange={(collapsible) => {
              if (collapsible) {
                update({ collapsible: collapsible as "icon" | "offcanvas" });
              }
            }}
            type="single"
            value={preferences.collapsible}
          >
            {(["offcanvas", "icon"] as const).map((collapsible) => (
              <ToggleGroupItem
                aria-label={collapseLabels[collapsible]}
                className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
                key={collapsible}
                value={collapsible}
              >
                {collapseLabels[collapsible]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </AppearanceRow>
      </div>
    </AppearanceSection>
  );
}
