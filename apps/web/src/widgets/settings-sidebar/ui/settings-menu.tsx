"use client";

import type { Route } from "next";

import { settingsMenu } from "@/shared/constants/navigation";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";

export function SettingsMenu() {
  const pathname = usePathname();

  return (
    <div className="sticky top-2 flex flex-col gap-1">
      {settingsMenu.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const isDestructive = item.variant === "destructive";

        return (
          <AppButton
            asChild
            className={cn(
              "justify-start transition-colors",
              isDestructive &&
                isActive &&
                "bg-destructive/10 text-destructive hover:bg-destructive/10 hover:text-destructive",

              isDestructive &&
                !isActive &&
                "text-destructive hover:bg-destructive/10 hover:text-destructive",

              !isDestructive &&
                isActive &&
                "bg-accent font-bold text-accent-foreground hover:bg-accent hover:text-accent-foreground",

              !isDestructive &&
                !isActive &&
                "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            key={item.href}
            variant="ghost"
          >
            <Link className="flex w-full items-center gap-2" href={item.href as Route}>
              {item.icon != null && <item.icon />}
              {item.label}
            </Link>
          </AppButton>
        );
      })}
    </div>
  );
}
