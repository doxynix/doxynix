"use client";

import { AppTooltip } from "@/shared/ui/AppTooltip";
import { SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";

export function SidebarToggle() {
  const { state } = useSidebar();

  return (
    <AppTooltip content={state === "expanded" ? "Collapse" : "Expand"}>
      <SidebarTrigger className="text-muted-foreground hover:cursor-pointer" variant="ghost" />
    </AppTooltip>
  );
}
