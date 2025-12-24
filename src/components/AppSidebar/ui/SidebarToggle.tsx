"use client";

import { AppTooltip } from "@/shared/ui/AppTooltip";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function SidebarToggle() {
  const { state } = useSidebar();

  return (
    <AppTooltip content={state === "expanded" ? "Свернуть" : "Развернуть"}>
      <SidebarTrigger variant="default" />
    </AppTooltip>
  );
}
