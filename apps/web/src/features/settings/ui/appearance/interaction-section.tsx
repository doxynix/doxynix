"use client";

import { useTranslations } from "next-intl";

import { Switch } from "@/shared/ui/core/switch";

import type { AppearanceSectionProps } from "../../model/appearance/appearance.types";
import { AppearanceRow, AppearanceSection } from "./appearance-section";

const POINTER_CURSOR_ID = "appearance-pointer-cursor";
const REDUCE_MOTION_ID = "appearance-reduce-motion";
const SINGLE_KEY_SHORTCUTS_ID = "appearance-single-key-shortcuts";
const UNDERLINE_LINKS_ID = "appearance-underline-links";

export function InteractionSection({ preferences, update }: Readonly<AppearanceSectionProps>) {
  const t = useTranslations("Dashboard");

  return (
    <AppearanceSection
      description={t("settings_appearance_behavior_desc")}
      title={t("settings_appearance_behavior_title")}
    >
      <div className="flex flex-col gap-5">
        <AppearanceRow
          description={t("settings_appearance_pointer_desc")}
          htmlFor={POINTER_CURSOR_ID}
          title={t("settings_appearance_pointer_title")}
        >
          <Switch
            checked={preferences.pointerCursor}
            id={POINTER_CURSOR_ID}
            onCheckedChange={(pointerCursor) => {
              update({ pointerCursor });
            }}
          />
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_underline_desc")}
          htmlFor={UNDERLINE_LINKS_ID}
          title={t("settings_appearance_underline_title")}
        >
          <Switch
            checked={preferences.underlineLinks}
            id={UNDERLINE_LINKS_ID}
            onCheckedChange={(underlineLinks) => {
              update({ underlineLinks });
            }}
          />
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_motion_desc")}
          htmlFor={REDUCE_MOTION_ID}
          title={t("settings_appearance_motion_title")}
        >
          <Switch
            checked={preferences.reduceMotion}
            id={REDUCE_MOTION_ID}
            onCheckedChange={(reduceMotion) => {
              update({ reduceMotion });
            }}
          />
        </AppearanceRow>

        <AppearanceRow
          description={t("settings_appearance_shortcuts_desc")}
          htmlFor={SINGLE_KEY_SHORTCUTS_ID}
          title={t("settings_appearance_shortcuts_title")}
        >
          <Switch
            checked={preferences.singleKeyShortcuts}
            id={SINGLE_KEY_SHORTCUTS_ID}
            onCheckedChange={(singleKeyShortcuts) => {
              update({ singleKeyShortcuts });
            }}
          />
        </AppearanceRow>
      </div>
    </AppearanceSection>
  );
}
