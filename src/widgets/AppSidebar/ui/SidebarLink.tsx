"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquareArrowOutUpRight } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { MenuItem } from "@/shared/types/menuItem";
import { SidebarMenuButton } from "@/shared/ui/sidebar";

export function SidebarLink({ href, label: title, icon: Icon, isBlank, exact }: MenuItem) {
  const pathname = usePathname();
  const blank = isBlank === true;
  const isActive =
    exact === true
      ? pathname === href
      : !blank && (pathname === href || (href !== "/dashboard" && pathname?.startsWith(href)));

  return (
    <SidebarMenuButton
      tooltip={`${title}`}
      className={cn(
        "flex transition-colors",
        isActive
          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground font-bold"
          : "hover:bg-primary text-muted-foreground hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
      )}
      asChild
    >
      <Link
        href={href as Route}
        target={blank ? "_blank" : undefined}
        rel={blank ? "noopener noreferrer" : undefined}
      >
        {Icon && <Icon />}
        {<span className="truncate">{title}</span>}
        {blank && <SquareArrowOutUpRight className="ml-auto" />}
      </Link>
    </SidebarMenuButton>
  );
}
