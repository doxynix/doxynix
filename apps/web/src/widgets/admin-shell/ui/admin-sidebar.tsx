"use client";

import { ADMIN_SIDEBAR_MENU } from "@/shared/config/navigation";
import { useNavLabels } from "@/shared/config/navigation-labels";
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/shared/ui/core/sidebar";

import { AdminSidebarLink } from "./admin-sidebar-link";

export function AdminSidebar() {
  const navLabels = useNavLabels();

  return (
    <Sidebar
      className="top-16 h-[calc(100dvh-4rem)]"
      collapsible="offcanvas"
      variant="sidebar"
    >
      <SidebarHeader>
        <SidebarMenu>
          {ADMIN_SIDEBAR_MENU.map((item) => (
            <SidebarMenuItem key={item.href}>
              {item.href != null && (
                <AdminSidebarLink
                  href={item.href}
                  icon={item.icon}
                  label={navLabels[item.labelKey]}
                />
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="m-0" />

      <SidebarRail />
    </Sidebar>
  );
}
