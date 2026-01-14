"use client";

import { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { settingsMenu } from "@/shared/constants/navigation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

export function SettingsMenu() {
  const pathname = usePathname();

  return (
    <div className="sticky top-2 flex flex-col gap-4">
      {settingsMenu.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const isDestructive = item.variant === "destructive";

        return (
          <Button
            key={item.href}
            className={cn(
              "justify-start transition-colors",
              isDestructive &&
                isActive &&
                "bg-destructive/10 hover:text-destructive text-destructive hover:bg-destructive/10",

              isDestructive &&
                !isActive &&
                "text-destructive/75 hover:bg-destructive/10 hover:text-destructive",

              !isDestructive &&
                isActive &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold",

              !isDestructive &&
                !isActive &&
                "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            variant="ghost"
            asChild
          >
            <Link href={item.href as Route} className="flex w-full items-center gap-2">
              {item.icon && <item.icon />}
              {item.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
