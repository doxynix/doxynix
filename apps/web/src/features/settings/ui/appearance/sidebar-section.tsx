"use client";

import { useTranslations } from "next-intl";

import type { SidebarVariant } from "@/shared/lib/appearance-preferences";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/core/toggle-group";

import type { AppearanceSectionProps } from "../../model/appearance/appearance.types";

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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings_appearance_sidebar_title")}</CardTitle>
        <CardDescription>{t("settings_appearance_sidebar_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="font-medium text-sm">{t("settings_appearance_sidebar_style_label")}</p>
            <p className="text-muted-foreground text-xs">
              {t("settings_appearance_sidebar_style_desc")}
            </p>
          </div>
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
        </div>
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="font-medium text-sm">{t("settings_appearance_sidebar_collapse_title")}</p>
            <p className="text-muted-foreground text-xs">
              {t("settings_appearance_sidebar_collapse_desc")}
            </p>
          </div>
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
        </div>
      </CardContent>
    </Card>
  );
}
