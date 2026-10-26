"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Label } from "@/shared/ui/core/label";
import { Switch } from "@/shared/ui/core/switch";

import type { AppearanceSectionProps } from "../model/appearance.types";

const POINTER_CURSOR_ID = "appearance-pointer-cursor";
const REDUCE_MOTION_ID = "appearance-reduce-motion";
const UNDERLINE_LINKS_ID = "appearance-underline-links";

export function InteractionSection({ preferences, update }: Readonly<AppearanceSectionProps>) {
  const t = useTranslations("Dashboard");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings_appearance_behavior_title")}</CardTitle>
        <CardDescription>{t("settings_appearance_behavior_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <Label
              className="text-sm"
              htmlFor={POINTER_CURSOR_ID}
            >
              {t("settings_appearance_pointer_title")}
            </Label>
            <p className="text-muted-foreground text-xs">{t("settings_appearance_pointer_desc")}</p>
          </div>
          <Switch
            checked={preferences.pointerCursor}
            id={POINTER_CURSOR_ID}
            onCheckedChange={(pointerCursor) => {
              update({ pointerCursor });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-6">
          <div>
            <Label
              className="text-sm"
              htmlFor={UNDERLINE_LINKS_ID}
            >
              {t("settings_appearance_underline_title")}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t("settings_appearance_underline_desc")}
            </p>
          </div>
          <Switch
            checked={preferences.underlineLinks}
            id={UNDERLINE_LINKS_ID}
            onCheckedChange={(underlineLinks) => {
              update({ underlineLinks });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-6">
          <div>
            <Label
              className="text-sm"
              htmlFor={REDUCE_MOTION_ID}
            >
              {t("settings_appearance_motion_title")}
            </Label>
            <p className="text-muted-foreground text-xs">{t("settings_appearance_motion_desc")}</p>
          </div>
          <Switch
            checked={preferences.reduceMotion}
            id={REDUCE_MOTION_ID}
            onCheckedChange={(reduceMotion) => {
              update({ reduceMotion });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
