"use client";

import type { Route } from "next";
import { SlashIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/core/breadcrumb";
import { useSidebar } from "@/shared/ui/core/sidebar";
import { Logo } from "@/shared/ui/icons/logo";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { AppCommandMenu } from "./app-command-menu";

import { Link, usePathname } from "@/i18n/routing";
import { NotificationsNav } from "./notifications-nav";
import { SidebarToggle } from "./sidebar-toggle";
import { UserNav } from "./user-nav";

export function AppHeader() {
  const { state } = useSidebar();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="bg-background flex h-full items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <AppTooltip content={cn(state === "expanded" ? "Hide" : "Show")}>
          <SidebarToggle />
        </AppTooltip>

        <Logo className="mt-1 w-20" />

        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;

              const decodedSegment = decodeURIComponent(segment);

              const textClasses = "truncate lowercase";

              const widthClasses = isLast
                ? "max-w-[140px] xl:max-w-[300px]"
                : "max-w-[70px] xl:max-w-[120px]";

              return (
                <div key={href} className="flex items-center gap-1.5">
                  <BreadcrumbSeparator>
                    <SlashIcon className="rotate-340" />
                  </BreadcrumbSeparator>

                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className={cn(textClasses, widthClasses)}>
                        {decodedSegment}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={href as Route} className={cn(textClasses, widthClasses)}>
                          {decodedSegment}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <AppTooltip content="Work in Progress">
          <span className="text-warning bg-warning/20 cursor-default rounded p-1 py-0.5 text-xs">
            BETA
          </span>
        </AppTooltip>
        <AppCommandMenu />
        {/* <ThemeToggle className="text-muted-foreground" /> // THEME: на время!*/}
        <NotificationsNav />
        <UserNav />
      </div>
    </header>
  );
}
