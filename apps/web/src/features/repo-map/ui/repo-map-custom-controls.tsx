"use client";

import type { ComponentType } from "react";
import { Panel } from "@xyflow/react";
import { Eye, EyeOff, FocusIcon, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
import { ShortcutHint } from "@/shared/ui/core/shortcut-hint";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { useMapCommands } from "../model/use-map-commands";
import { useMapControlsActions, useMapControlsHide } from "../model/use-repo-map.store";

type ControlItem = {
  action: () => void;
  icon: ComponentType<{ className?: string }>;
  id: string;
  label: string;
  shortcut: string;
};

const SHORTCUTS = {
  fitView: "F then V",
  focusSelected: "F then S",
  toggleControls: "T then C",
  zoomIn: "Z then I",
  zoomOut: "Z then O",
} as const;

export function RepoMapCustomControls() {
  const t = useTranslations("Dashboard");
  const hide = useMapControlsHide();
  const { toggleControls } = useMapControlsActions();
  const map = useMapCommands();

  const CONTROLS_CONFIG: ControlItem[] = [
    {
      action: map.zoomIn,
      icon: ZoomIn,
      id: "zoom-in",
      label: t("repo_map_zoom_in"),
      shortcut: SHORTCUTS.zoomIn,
    },
    {
      action: map.zoomOut,
      icon: ZoomOut,
      id: "zoom-out",
      label: t("repo_map_zoom_out"),
      shortcut: SHORTCUTS.zoomOut,
    },
    {
      action: map.fitView,
      icon: Maximize,
      id: "fit-view",
      label: t("repo_map_fit_view"),
      shortcut: SHORTCUTS.fitView,
    },
    {
      action: map.focusSelected,
      icon: FocusIcon,
      id: "focus",
      label: t("repo_map_focus_selected"),
      shortcut: SHORTCUTS.focusSelected,
    },
  ];

  return (
    <Panel
      className="flex flex-col gap-1"
      position="bottom-left"
    >
      {CONTROLS_CONFIG.map((item) => (
        <AppTooltip
          content={
            <span className="flex items-center gap-1.5">
              {item.label}
              <ShortcutHint
                className="ml-0"
                shortcut={item.shortcut}
              />
            </span>
          }
          key={item.id}
          side="left"
        >
          <AppButton
            aria-label={item.label}
            className={cn(
              "transition-standard",
              hide
                ? "pointer-events-none -translate-x-full opacity-0"
                : "translate-x-0 opacity-100",
            )}
            onClick={item.action}
            size="icon"
            variant="outline"
          >
            <item.icon />
          </AppButton>
        </AppTooltip>
      ))}

      <AppTooltip
        content={
          <span className="flex items-center gap-1.5">
            {t("repo_map_toggle_controls")}
            <ShortcutHint
              className="ml-0"
              shortcut={SHORTCUTS.toggleControls}
            />
          </span>
        }
        side="left"
      >
        <AppButton
          aria-label={t("repo_map_toggle_controls")}
          onClick={toggleControls}
          size="icon"
          variant="outline"
        >
          {hide ? <EyeOff /> : <Eye />}
        </AppButton>
      </AppTooltip>
    </Panel>
  );
}
