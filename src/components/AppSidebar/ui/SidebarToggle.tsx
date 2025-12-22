"use client";

import { AppTooltip } from "@/shared/AppTooltip";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function SidebarToggle() {
  const { state } = useSidebar();

  return (
    <AppTooltip content={state === "expanded" ? "Свернуть" : "Развернуть"}>
      <SidebarTrigger />
    </AppTooltip>
  );
}
