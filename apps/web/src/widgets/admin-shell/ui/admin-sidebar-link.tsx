"use client";

import { SquareArrowOutUpRight } from "lucide-react";

import type { MenuItem } from "@/shared/config/navigation.types";
import { Link, usePathname } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/cn";
import { isRouteActive } from "@/shared/lib/navigation-utils";
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuShortcut } from "@/shared/ui/core/sidebar";

type Props = Omit<MenuItem, "labelKey"> & { label: string };

export function AdminSidebarLink({
  exact,
  href,
  icon: Icon,
  isBlank,
  label,
  notificationsCount,
  shortcut,
}: Readonly<Props>) {
  const pathname = usePathname();
  const blank = isBlank === true;
  if (href == null) {
    return null;
  }

  const isActive = !blank && isRouteActive(pathname, href, exact);

  return (
    <SidebarMenuButton
      asChild
      className={cn(
        "group/link flex cursor-pointer transition-colors",
        isActive
          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground hover:bg-sidebar-accent"
          : "text-muted-foreground hover:bg-accent! hover:text-foreground",
      )}
      isActive={isActive}
    >
      <Link
        href={href}
        rel={blank ? "noopener noreferrer" : undefined}
        target={blank ? "_blank" : undefined}
      >
        {Icon != null && <Icon className="size-3.5" />}

        <span className="min-w-0 flex-1 truncate">{label}</span>

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
