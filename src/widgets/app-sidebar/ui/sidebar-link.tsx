"use client";

import type { Route } from "next";
import { SquareArrowOutUpRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { MenuItem } from "@/shared/types/menu-item";
import { SidebarMenuButton, SidebarMenuShortcut } from "@/shared/ui/core/sidebar";

import { Link, usePathname } from "@/i18n/routing";

export function SidebarLink({
  href,
  label: title,
  icon: Icon,
  isBlank,
  exact,
  shortcut,
}: MenuItem) {
  const pathname = usePathname() ?? "";
  const blank = isBlank === true;
  if (href === undefined) {
    return null;
  }

  const isActive = (() => {
    if (blank) return false;

    if (exact === true) return pathname === href;

    const cleanPath = pathname.replace(/\/$/, "");
    const cleanHref = href.replace(/\/$/, "");

    if (!cleanPath.startsWith(cleanHref)) return false;

    const pathSegments = cleanPath.split("/").filter(Boolean);
    const hrefSegments = cleanHref.split("/").filter(Boolean);

    const depthDelta = pathSegments.length - hrefSegments.length;

    return depthDelta <= 1;
  })();

  return (
    <SidebarMenuButton
      tooltip={`${title}`}
      className={cn(
        "group/link flex cursor-default transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground font-bold"
          : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground"
      )}
      asChild
    >
      <Link
        href={href as Route}
        target={blank ? "_blank" : undefined}
        rel={blank ? "noopener noreferrer" : undefined}
      >
        <Icon />
        {<span className="truncate">{title}</span>}
        {shortcut !== undefined && (
          <SidebarMenuShortcut className="opacity-0 transition-opacity group-hover/link:opacity-100">
            {shortcut}
          </SidebarMenuShortcut>
        )}
        {blank && <SquareArrowOutUpRight className="ml-auto" />}
      </Link>
    </SidebarMenuButton>
  );
}
