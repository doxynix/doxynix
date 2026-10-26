"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import {
  AUTO_CODE_THEMES,
  CODE_THEMES_DARK,
  CODE_THEMES_LIGHT,
  type CodeTheme,
  codeThemeTone,
} from "@/shared/lib/appearance-preferences";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/core/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/core/popover";

import type { AppearanceSectionProps } from "../model/appearance.types";
import { CODE_SAMPLES, DEFAULT_CODE_SAMPLE_ID, findCodeSample } from "../model/code-samples";
import { CodePreview } from "./code-preview";

export function CodeThemeSection({ preferences, update }: Readonly<AppearanceSectionProps>) {
  const { resolvedTheme } = useTheme();
  const t = useTranslations("Dashboard");
  const [sampleId, setSampleId] = useState<string>(DEFAULT_CODE_SAMPLE_ID);

  const appTone = resolvedTheme === "light" ? "light" : "dark";
  const storedTheme = preferences.codeTheme;
  const activeTheme: CodeTheme =
    storedTheme !== "auto" && codeThemeTone(storedTheme) !== appTone ? "auto" : storedTheme;

  const labelByTheme: Record<CodeTheme, string> = {
    andromeeda: t("settings_appearance_code_theme_andromeeda"),
    "aurora-x": t("settings_appearance_code_theme_aurora_x"),
    auto: t("settings_appearance_code_theme_auto"),
    "ayu-dark": t("settings_appearance_code_theme_ayu_dark"),
    "ayu-light": t("settings_appearance_code_theme_ayu_light"),
    "ayu-mirage": t("settings_appearance_code_theme_ayu_mirage"),
    "catppuccin-frappe": t("settings_appearance_code_theme_catppuccin_frappe"),
    "catppuccin-latte": t("settings_appearance_code_theme_catppuccin_latte"),
    "catppuccin-macchiato": t("settings_appearance_code_theme_catppuccin_macchiato"),
    "catppuccin-mocha": t("settings_appearance_code_theme_catppuccin_mocha"),
    "dark-plus": t("settings_appearance_code_theme_dark_plus"),
    dracula: t("settings_appearance_code_theme_dracula"),
    "dracula-soft": t("settings_appearance_code_theme_dracula_soft"),
    "everforest-dark": t("settings_appearance_code_theme_everforest_dark"),
    "everforest-light": t("settings_appearance_code_theme_everforest_light"),
    "github-dark": t("settings_appearance_code_theme_github_dark"),
    "github-dark-default": t("settings_appearance_code_theme_github_dark_default"),
    "github-dark-dimmed": t("settings_appearance_code_theme_github_dark_dimmed"),
    "github-dark-high-contrast": t("settings_appearance_code_theme_github_dark_high_contrast"),
    "github-light": t("settings_appearance_code_theme_github_light"),
    "github-light-default": t("settings_appearance_code_theme_github_light_default"),
    "github-light-high-contrast": t("settings_appearance_code_theme_github_light_high_contrast"),
    "gruvbox-dark-hard": t("settings_appearance_code_theme_gruvbox_dark_hard"),
    "gruvbox-dark-medium": t("settings_appearance_code_theme_gruvbox_dark_medium"),
    "gruvbox-dark-soft": t("settings_appearance_code_theme_gruvbox_dark_soft"),
    "gruvbox-light-hard": t("settings_appearance_code_theme_gruvbox_light_hard"),
    "gruvbox-light-medium": t("settings_appearance_code_theme_gruvbox_light_medium"),
    "gruvbox-light-soft": t("settings_appearance_code_theme_gruvbox_light_soft"),
    horizon: t("settings_appearance_code_theme_horizon"),
    "horizon-bright": t("settings_appearance_code_theme_horizon_bright"),
    houston: t("settings_appearance_code_theme_houston"),
    "kanagawa-dragon": t("settings_appearance_code_theme_kanagawa_dragon"),
    "kanagawa-lotus": t("settings_appearance_code_theme_kanagawa_lotus"),
    "kanagawa-wave": t("settings_appearance_code_theme_kanagawa_wave"),
    laserwave: t("settings_appearance_code_theme_laserwave"),
    "light-plus": t("settings_appearance_code_theme_light_plus"),
    "material-theme": t("settings_appearance_code_theme_material_theme"),
    "material-theme-darker": t("settings_appearance_code_theme_material_theme_darker"),
    "material-theme-lighter": t("settings_appearance_code_theme_material_theme_lighter"),
    "material-theme-ocean": t("settings_appearance_code_theme_material_theme_ocean"),
    "material-theme-palenight": t("settings_appearance_code_theme_material_theme_palenight"),
    "min-dark": t("settings_appearance_code_theme_min_dark"),
    "min-light": t("settings_appearance_code_theme_min_light"),
    monokai: t("settings_appearance_code_theme_monokai"),
    "night-owl": t("settings_appearance_code_theme_night_owl"),
    "night-owl-light": t("settings_appearance_code_theme_night_owl_light"),
    nord: t("settings_appearance_code_theme_nord"),
    "one-dark-pro": t("settings_appearance_code_theme_one_dark_pro"),
    "one-light": t("settings_appearance_code_theme_one_light"),
    plastic: t("settings_appearance_code_theme_plastic"),
    poimandres: t("settings_appearance_code_theme_poimandres"),
    red: t("settings_appearance_code_theme_red"),
    "rose-pine": t("settings_appearance_code_theme_rose_pine"),
    "rose-pine-dawn": t("settings_appearance_code_theme_rose_pine_dawn"),
    "rose-pine-moon": t("settings_appearance_code_theme_rose_pine_moon"),
    "slack-dark": t("settings_appearance_code_theme_slack_dark"),
    "slack-ochin": t("settings_appearance_code_theme_slack_ochin"),
    "snazzy-light": t("settings_appearance_code_theme_snazzy_light"),
    "solarized-dark": t("settings_appearance_code_theme_solarized_dark"),
    "solarized-light": t("settings_appearance_code_theme_solarized_light"),
    "synthwave-84": t("settings_appearance_code_theme_synthwave_84"),
    "tokyo-night": t("settings_appearance_code_theme_tokyo_night"),
    vesper: t("settings_appearance_code_theme_vesper"),
    "vitesse-black": t("settings_appearance_code_theme_vitesse_black"),
    "vitesse-dark": t("settings_appearance_code_theme_vitesse_dark"),
    "vitesse-light": t("settings_appearance_code_theme_vitesse_light"),
  };

  const availableThemes: readonly CodeTheme[] =
    appTone === "light" ? ["auto", ...CODE_THEMES_LIGHT] : ["auto", ...CODE_THEMES_DARK];

  const previewTheme: Exclude<CodeTheme, "auto"> =
    activeTheme !== "auto" ? activeTheme : AUTO_CODE_THEMES[appTone];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings_appearance_code_theme_title")}</CardTitle>
        <CardDescription>{t("settings_appearance_code_theme_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="font-medium text-sm">{t("settings_appearance_code_theme_row_title")}</p>
            <p className="text-muted-foreground text-xs">
              {t("settings_appearance_code_theme_row_desc")}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <AppButton
                aria-haspopup="dialog"
                className="w-60 justify-between font-normal"
                variant="outline"
              >
                <span className="truncate">{labelByTheme[activeTheme]}</span>
                <ChevronDown className="ml-2 size-3.5 opacity-50 shrink-0" />
              </AppButton>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-0"
            >
              <Command>
                <CommandInput placeholder={t("settings_appearance_code_theme_search")} />
                <CommandList>
                  <CommandEmpty>{t("settings_appearance_code_theme_no_theme_found")}</CommandEmpty>
                  <CommandGroup>
                    {availableThemes.map((theme) => (
                      <CommandItem
                        key={theme}
                        onSelect={() => {
                          update({ codeTheme: theme });
                        }}
                        value={labelByTheme[theme]}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            activeTheme === theme ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{labelByTheme[theme]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="font-medium text-sm">{t("settings_appearance_code_lang_row_title")}</p>
            <p className="text-muted-foreground text-xs">
              {t("settings_appearance_code_lang_row_desc")}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <AppButton
                aria-haspopup="dialog"
                className="w-60 justify-between font-normal"
                variant="outline"
              >
                <span className="truncate">{findCodeSample(sampleId).label}</span>
                <ChevronDown className="ml-2 size-3.5 opacity-50 shrink-0" />
              </AppButton>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-0"
            >
              <Command>
                <CommandInput placeholder={t("settings_appearance_code_lang_search")} />
                <CommandList>
                  <CommandEmpty>{t("settings_appearance_code_lang_not_found")}</CommandEmpty>
                  <CommandGroup>
                    {CODE_SAMPLES.map((sample) => (
                      <CommandItem
                        key={sample.id}
                        onSelect={() => {
                          setSampleId(sample.id);
                        }}
                        value={sample.label}
                      >
                        <Check
                          className={cn(
                            "mr-2",
                            sampleId === sample.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{sample.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <CodePreview
          code={findCodeSample(sampleId).sample}
          lang={findCodeSample(sampleId).id}
          theme={previewTheme}
          title={findCodeSample(sampleId).label}
          tone={appTone}
        />
      </CardContent>
    </Card>
  );
}
