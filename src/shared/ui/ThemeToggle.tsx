"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/utils";
import { AppTooltip } from "@/shared/ui/AppTooltip";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-9 w-9 rounded-xl" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <AppTooltip content={isDark ? "Light mode" : "Dark mode"}>
      <Button
        className={cn(className)}
        variant="ghost"
        size="icon"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Moon className="h-4.5" /> : <Sun className="h-4.5" />}
      </Button>
    </AppTooltip>
  );
}
