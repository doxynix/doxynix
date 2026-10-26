"use client";

import type { Route } from "next";

import { settingsMenu } from "@/shared/config/navigation";
import { useNavLabels } from "@/shared/config/navigation-labels";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";

export function SettingsMenu() {
  const pathname = usePathname();
  const navLabels = useNavLabels();

  return (
    <div className="sticky top-2 flex flex-col gap-0.25">
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
                "bg-destructive/20 text-destructive hover:bg-destructive/20 hover:text-destructive",

              isDestructive &&
                !isActive &&
                "text-destructive hover:bg-destructive/10 hover:text-destructive",

              !isDestructive &&
                isActive &&
                "bg-sidebar-accent font-bold text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",

              !isDestructive &&
                !isActive &&
                "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            key={item.href}
            variant="ghost"
          >
            <Link
              className="flex w-full items-center gap-2"
              href={item.href as Route}
            >
              {item.icon != null && <item.icon />}
              {navLabels[item.labelKey]}
            </Link>
          </AppButton>
        );
      })}
    </div>
  );
}
