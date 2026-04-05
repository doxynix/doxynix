"use client";

import type { Route } from "next";
import { SquareArrowOutUpRight } from "lucide-react";

import { cn, isRouteActive } from "@/shared/lib/utils";
import type { MenuItem } from "@/shared/types/navigation.types";
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuShortcut } from "@/shared/ui/core/sidebar";
import { Link, usePathname } from "@/i18n/routing";

export function SidebarLink({
  exact,
  href,
  icon: Icon,
  isBlank,
  label: title,
  notificationsCount,
  shortcut,
}: Readonly<MenuItem>) {
  const pathname = usePathname();
  const blank = isBlank === true;
  if (href == null) {
    return null;
  }

  const isActive = !blank && isRouteActive(pathname, href, exact);

  return (
    <SidebarMenuButton
      asChild
      tooltip={`${title}`}
      className={cn(
        "group/link flex cursor-default transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent font-bold"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Link
        href={href as Route}
        rel={blank ? "noopener noreferrer" : undefined}
        target={blank ? "_blank" : undefined}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{title}</span>

        <div className="ml-auto flex items-center gap-2">
          {notificationsCount != null && notificationsCount > 0 && (
            <SidebarMenuBadge>
              {notificationsCount > 9 ? "9+" : notificationsCount}
            </SidebarMenuBadge>
          )}
          {shortcut != null && (
            <SidebarMenuShortcut className="opacity-0 transition-opacity group-hover/link:opacity-100">
              {shortcut}
            </SidebarMenuShortcut>
          )}
        </div>
        {blank && <SquareArrowOutUpRight className="ml-auto size-3.5" />}
      </Link>
    </SidebarMenuButton>
  );
}
