"use client";

import type { ComponentType } from "react";
import { Panel } from "@xyflow/react";
import { Eye, EyeOff, FocusIcon, Maximize, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { useMapCommands, useMapControlsActions, useMapControlsHide } from "@/entities/repo-map";

type ControlItem = {
  action: () => void;
  icon: ComponentType<{ className?: string }>;
  id: string;
  label: string;
};

export function RepoMapCustomControls() {
  const hide = useMapControlsHide();
  const { toggleControls } = useMapControlsActions();
  const map = useMapCommands();

  const CONTROLS_CONFIG: ControlItem[] = [
    { action: map.zoomIn, icon: ZoomIn, id: "zoom-in", label: "Zoom In (Z then I)" },
    { action: map.zoomOut, icon: ZoomOut, id: "zoom-out", label: "Zoom Out (Z then O)" },
    { action: map.fitView, icon: Maximize, id: "fit-view", label: "Fit View (F then V)" },
    { action: map.focusSelected, icon: FocusIcon, id: "focus", label: "Focus Selected (F then S)" },
  ];

  return (
    <Panel position="bottom-left" className="flex flex-col gap-1">
      {CONTROLS_CONFIG.map((item) => (
        <AppTooltip key={item.id} content={item.label} side="left">
          <Button
            size="icon"
            variant="outline"
            onClick={item.action}
            className={cn(
              "transition-all duration-300",
              hide ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"
            )}
          >
            <item.icon className="size-4" />
          </Button>
        </AppTooltip>
      ))}

      <AppTooltip content="Toggle Controls (T then C)" side="left">
        <Button size="icon" variant="outline" onClick={toggleControls}>
          {hide ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </AppTooltip>
    </Panel>
  );
}
