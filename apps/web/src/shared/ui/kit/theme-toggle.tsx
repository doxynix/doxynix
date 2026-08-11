"use client";

import { useTheme } from "next-themes";

import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import { AnimatedThemeToggler } from "../core/animated-theme-toggler";

export function ThemeToggle() {
  const { forcedTheme } = useTheme();

  if (forcedTheme != null) return null;

  return (
    <AppTooltip content="Toggle theme">
      <div className="flex items-center justify-center">
        <AnimatedThemeToggler variant="circle" />
      </div>
    </AppTooltip>
  );
}
