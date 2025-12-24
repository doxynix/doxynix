"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarMenuButton } from "@/components/ui/sidebar";

import { MenuItem } from "@/components/AppSidebar/types";
import { cn } from "@/lib/utils";

export function SidebarLink({ href, title, icon: Icon }: MenuItem) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <SidebarMenuButton
      className={cn(
        "flex transition-colors duration-300",
        isActive
          ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
          : "hover:bg-primary hover:text-primary-foreground active:bg-primary active:text-primary-foreground"
      )}
      asChild
    >
      <Link href={href}>
        {Icon && <Icon />}
        {title}
      </Link>
    </SidebarMenuButton>
  );
}
