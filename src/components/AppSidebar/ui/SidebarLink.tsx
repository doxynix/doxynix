"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MenuItem } from "@/components/AppSidebar/types";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarLink({ href, title, icon: Icon }: MenuItem) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <SidebarMenuButton
      className={cn(
        "flex transition-colors",
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
