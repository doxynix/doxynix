"use client";

import { usePathname } from "next/navigation";
import { SlashIcon } from "lucide-react";

import { LOCALES, type Locale } from "@/shared/constants/locales";
import { cn } from "@/shared/lib/utils";
import { useSidebar } from "@/shared/ui/core/sidebar";
import { Logo } from "@/shared/ui/icons/logo";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ThemeToggle } from "@/shared/ui/kit/theme-toggle";

import { AppCommandMenu } from "./app-command-menu";
import { NotificationsNav } from "./notifications-nav";
import { SidebarToggle } from "./sidebar-toggle";
import { UserNav } from "./user-nav";

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && LOCALES.includes(first as Locale)) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

export function AppHeader() {
  const { state } = useSidebar();
  const rawPathname = usePathname();
  const pathname = stripLocalePrefix(rawPathname);
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbItems = segments.map((segment, index) => ({
    className: cn(
      "lowercase",
      index === segments.length - 1
        ? "max-w-[140px] xl:max-w-[300px]"
        : "max-w-[70px] xl:max-w-[120px]"
    ),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: segment,
  }));

  return (
    <header className="bg-background flex h-full items-center justify-between p-4">
      <div className="flex items-center gap-2.5">
        <AppTooltip content={cn(state === "expanded" ? "Hide" : "Show")}>
          <SidebarToggle />
        </AppTooltip>

        <Logo className="mt-1 w-20" />

        <AppBreadcrumbs
          items={breadcrumbItems}
          separator={<SlashIcon className="size-3 rotate-340" />}
          showSeparatorAtStart={true}
          className="hidden md:block"
        />
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <AppTooltip content="Work in Progress">
          <span className="text-warning bg-warning/20 cursor-default rounded p-1 py-0.5 text-xs">
            BETA
          </span>
        </AppTooltip>
        <AppCommandMenu />
        <ThemeToggle className="text-muted-foreground" />
        <NotificationsNav />
        <UserNav />
      </div>
    </header>
  );
}
