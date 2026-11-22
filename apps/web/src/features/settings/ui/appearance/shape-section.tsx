"use client";

import { useTranslations } from "next-intl";

import {
  RADIUS_PRESETS,
  type RadiusPreset,
  TEXT_SCALES,
  type TextScale,
} from "@/shared/lib/appearance-preferences";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/core/toggle-group";

import type { AppearanceSectionProps } from "../../model/appearance/appearance.types";
import { AppearanceRow, AppearanceSection } from "./appearance-section";

export function ShapeSection({ preferences, update }: Readonly<AppearanceSectionProps>) {
  const t = useTranslations("Dashboard");

  const radiusLabels: Record<RadiusPreset, string> = {
    default: t("settings_appearance_radius_default"),
    sharp: t("settings_appearance_radius_sharp"),
    soft: t("settings_appearance_radius_soft"),
  };

  const textLabels: Record<TextScale, string> = {
    compact: t("settings_appearance_text_compact"),
    default: t("settings_appearance_text_default"),
    large: t("settings_appearance_text_large"),
  };

  return (
    <AppearanceSection
      description={t("settings_appearance_shape_desc")}
      title={t("settings_appearance_shape_title")}
    >
      <div className="flex flex-col gap-4">
        <AppearanceRow
          description={t("settings_appearance_radius_desc")}
          title={t("settings_appearance_radius_title")}
        >
          <ToggleGroup
            className="inline-flex h-9 items-center rounded-lg border border-border bg-muted p-1"
            onValueChange={(radius) => {
              if (radius) {
                update({ radius: radius as RadiusPreset });
              }
            }}
            type="single"
            value={preferences.radius}
          >
            {RADIUS_PRESETS.map((r) => (
              <ToggleGroupItem
                aria-label={radiusLabels[r]}
                className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
                key={r}
                value={r}
              >
                {radiusLabels[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_text_desc")}
          title={t("settings_appearance_text_title")}
        >
          <ToggleGroup
            className="inline-flex h-9 items-center rounded-lg border border-border bg-muted p-1"
            onValueChange={(textScale) => {
              if (textScale) {
                update({ textScale: textScale as TextScale });
              }
            }}
            type="single"
            value={preferences.textScale}
          >
            {TEXT_SCALES.map((scale) => (
              <ToggleGroupItem
                aria-label={textLabels[scale]}
                className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
                key={scale}
                value={scale}
              >
                {textLabels[scale]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_border_desc")}
          title={t("settings_appearance_border_title")}
        >
          <ToggleGroup
            className="inline-flex h-9 items-center rounded-lg border border-border bg-muted p-1"
            onValueChange={(v) => {
              if (v) {
                update({ borderContrast: v as "soft" | "strong" });
              }
            }}
            type="single"
            value={preferences.borderContrast}
          >
            <ToggleGroupItem
              aria-label={t("settings_appearance_border_soft")}
              className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
              value="soft"
            >
              {t("settings_appearance_border_soft")}
            </ToggleGroupItem>
            <ToggleGroupItem
              aria-label={t("settings_appearance_border_strong")}
              className="rounded-md px-3 py-1 text-sm font-medium data-[state=on]:bg-accent data-[state=on]:text-foreground"
              value="strong"
            >
              {t("settings_appearance_border_strong")}
            </ToggleGroupItem>
          </ToggleGroup>
        </AppearanceRow>
      </div>
    </AppearanceSection>
  );
}
