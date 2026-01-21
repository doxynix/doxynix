"use client";

import { SidebarTrigger, useSidebar } from "@/shared/ui/core/sidebar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

export function SidebarToggle() {
  const { state } = useSidebar();

  return (
    <AppTooltip content={state === "expanded" ? "Collapse" : "Expand"}>
      <SidebarTrigger className="text-muted-foreground hover:cursor-pointer" variant="ghost" />
    </AppTooltip>
  );
}
