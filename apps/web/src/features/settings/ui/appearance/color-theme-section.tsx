"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { THEMES, type Theme } from "@/shared/lib/appearance-preferences";
import { cn } from "@/shared/lib/cn";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";
import { useMounted } from "@/shared/lib/hooks/use-mounted";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Label } from "@/shared/ui/core/label";

// Swatch tints are exaggerated (~2x the real interface chroma) so the theme reads at thumbnail size
const THEME_SWATCHES: Record<Theme, { ch: number; hue: number }> = {
  forest: { ch: 0.04, hue: 150 },
  mocha: { ch: 0.035, hue: 78 },
  neutral: { ch: 0.006, hue: 255 },
  ocean: { ch: 0.045, hue: 238 },
  sunset: { ch: 0.04, hue: 25 },
  violet: { ch: 0.045, hue: 310 },
};

type SwatchPalette = {
  card: string;
  cardRing: string;
  heading: string;
  page: string;
  sidebar: string;
  sidebarLine: string;
  sidebarLineMuted: string;
};

function swatchPalette(ch: number, hue: number, tone: "light" | "dark"): SwatchPalette {
  if (tone === "dark") {
    return {
      card: `oklch(0.23 ${1.1 * ch} ${hue})`,
      cardRing: `oklch(0.35 ${1.4 * ch} ${hue})`,
      heading: `oklch(0.88 ${0.4 * ch} ${hue})`,
      page: `oklch(0.15 ${0.8 * ch} ${hue})`,
      sidebar: `oklch(0.2 ${ch} ${hue})`,
      sidebarLine: `oklch(0.32 ${1.4 * ch} ${hue})`,
      sidebarLineMuted: `oklch(0.26 ${1.2 * ch} ${hue})`,
    };
  }

  return {
    card: "oklch(1 0 0)",
    cardRing: `oklch(0.88 ${1.4 * ch} ${hue})`,
    heading: `oklch(0.24 ${0.4 * ch} ${hue})`,
    page: `oklch(0.985 ${0.8 * ch} ${hue})`,
    sidebar: `oklch(0.955 ${ch} ${hue})`,
    sidebarLine: `oklch(0.86 ${1.4 * ch} ${hue})`,
    sidebarLineMuted: `oklch(0.9 ${1.2 * ch} ${hue})`,
  };
}

function ThemeSwatch({
  ch,
  hue,
  label,
  selected,
  onSelect,
  theme,
  tone,
}: Readonly<{
  ch: number;
  hue: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
  theme: Theme;
  tone: "light" | "dark";
}>) {
  const id = `color-theme-${theme}`;
  const palette = swatchPalette(ch, hue, tone);

  return (
    <Label
      className={cn(
        "flex flex-1 cursor-pointer flex-col gap-2 rounded-xl border p-2 font-normal transition-standard",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
        selected ? "border-primary bg-accent" : "border-input hover:bg-accent/50",
      )}
      htmlFor={id}
    >
      <input
        checked={selected}
        className="sr-only"
        id={id}
        name="color-theme"
        onChange={onSelect}
        type="radio"
        value={theme}
      />
      <div
        className={cn(
          "relative aspect-2/1 w-full overflow-hidden rounded-md ring-1 ring-inset",
          selected ? "ring-primary" : "ring-border",
        )}
      >
        <div className="flex h-full w-full">
          <div
            className="flex w-[30%] flex-col gap-[3px] p-[5px]"
            style={{ backgroundColor: palette.sidebar }}
          >
            <div
              className="h-[3px] w-3/5 rounded-full"
              style={{ backgroundColor: palette.sidebarLine }}
            />
            <div
              className="h-[2.5px] w-2/3 rounded-full"
              style={{ backgroundColor: palette.sidebarLineMuted }}
            />
          </div>
          <div
            className="flex flex-1 flex-col gap-[5px] p-[5px]"
            style={{ backgroundColor: palette.page }}
          >
            <div
              className="h-[5px] w-[46%] rounded-full"
              style={{ backgroundColor: palette.heading }}
            />
            <div className="grid flex-1 grid-cols-2 gap-1">
              <div
                className="rounded-[2px]"
                style={{
                  backgroundColor: palette.card,
                  boxShadow: `inset 0 0 0 1px ${palette.cardRing}`,
                }}
              />
              <div
                className="rounded-[2px]"
                style={{
                  backgroundColor: palette.card,
                  boxShadow: `inset 0 0 0 1px ${palette.cardRing}`,
                }}
              />
            </div>
          </div>
        </div>
        {selected && (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-2.5" />
          </span>
        )}
      </div>
      <span
        className={cn(
          "px-0.5 text-center text-sm",
          selected ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Label>
  );
}

export function ColorThemeSection() {
  const t = useTranslations("Dashboard");
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const { preferences, update } = useAppearancePreferences();

  const tone = resolvedTheme === "light" ? "light" : "dark";

  const labelByTheme: Record<Theme, string> = {
    forest: t("settings_appearance_color_theme_forest"),
    mocha: t("settings_appearance_color_theme_mocha"),
    neutral: t("settings_appearance_color_theme_neutral"),
    ocean: t("settings_appearance_color_theme_ocean"),
    sunset: t("settings_appearance_color_theme_sunset"),
    violet: t("settings_appearance_color_theme_violet"),
  };

  const activeTheme = mounted ? preferences.theme : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings_appearance_color_theme_title")}</CardTitle>
        <CardDescription>{t("settings_appearance_color_theme_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THEMES.map((theme) => {
            const swatch = THEME_SWATCHES[theme];
            return (
              <ThemeSwatch
                ch={swatch.ch}
                hue={swatch.hue}
                key={theme}
                label={labelByTheme[theme]}
                onSelect={() => {
                  update({ theme });
                }}
                selected={activeTheme === theme}
                theme={theme}
                tone={tone}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
