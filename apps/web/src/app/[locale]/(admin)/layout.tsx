import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { forbidden } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/shared/ui/core/sidebar";

import { AdminHeader } from "@/widgets/admin-shell/ui/admin-header";
import { AdminSidebar } from "@/widgets/admin-shell/ui/admin-sidebar";

import { auth } from "@/server/core/auth";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user.role !== "ADMIN") {
    forbidden();
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider
      className="flex h-dvh w-full flex-col overflow-hidden"
      defaultOpen={defaultOpen}
    >
      <div className="z-50 w-full shrink-0 border-b">
        <AdminHeader />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <div className="relative flex flex-1 flex-col overflow-y-auto">
          <SidebarInset
            className="mx-auto max-w-400 p-4"
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
