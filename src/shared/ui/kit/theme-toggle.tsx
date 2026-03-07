"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn, setClientCookie } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Readonly<Props>) {
  const { resolvedTheme, setTheme, forcedTheme } = useTheme();

  if (forcedTheme) return null;

  const toggleTheme = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    setClientCookie("doxynix-theme", newTheme, 31536000);
  };

  const isDark = resolvedTheme === "dark";

  return (
    <AppTooltip content="Toggle theme">
      <Button
        size="icon"
        variant="ghost"
        aria-label="Switch theme"
        onClick={toggleTheme}
        className={cn(className)}
      >
        <Sun className="block h-4.5 w-4.5 dark:hidden" />
        <Moon className="hidden h-4.5 w-4.5 dark:block" />
      </Button>
    </AppTooltip>
  );
}
