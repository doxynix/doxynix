"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { AppTooltip } from "@/shared/AppTooltip";
import { ThemeToggleProps } from "@/shared/ThemeToggle/types";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = resolvedTheme || theme;

  return (
    <AppTooltip content="Переключить тему">
      <Button
        className={cn(className, "hover:cursor-pointer")}
        onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      >
        {currentTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </AppTooltip>
  );
}
