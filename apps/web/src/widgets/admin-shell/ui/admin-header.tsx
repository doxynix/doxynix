"use client";

import { useNavLabels } from "@/shared/config/navigation-labels";
import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { SidebarTrigger } from "@/shared/ui/core/sidebar";
import { ThemeToggle } from "@/shared/ui/kit/theme-toggle";

import { AdminUserNav } from "./admin-user-nav";

export function AdminHeader() {
  const navLabels = useNavLabels();

  return (
    <header className="flex h-full flex-col justify-between bg-background px-4">
      <div className="flex w-full items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger />
          <Logo className="mt-1 w-20" />
          <span className="text-muted-foreground text-sm">{navLabels.admin_users}</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AdminUserNav />
        </div>
      </div>
    </header>
  );
}
