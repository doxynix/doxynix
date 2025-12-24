"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/ui/button";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { ThemeToggleProps } from "@/shared/ui/ThemeToggle/types";
import { cn } from "@/shared/lib/utils";

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const currentTheme = resolvedTheme ?? theme ?? "light";

  return (
    <AppTooltip
      content={cn(currentTheme === "dark" ? "Сменить тему на светлую" : "Сменить тему на темную")}
    >
      <Button
        className={cn(className, "hover:cursor-pointer")}
        variant="default"
        onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      >
        {currentTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </AppTooltip>
  );
}
