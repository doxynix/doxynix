import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";
import { SidebarProvider } from "@/shared/ui/core/sidebar";
import { CreateRepoDialog } from "@/features/repo";
import { AppFooter } from "@/widgets/app-footer";
import { AppHeader } from "@/widgets/app-header";
import { AppSidebar } from "@/widgets/app-sidebar";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session) redirect("/auth");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  return (
    <>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="flex h-dvh w-full flex-col overflow-hidden"
      >
        <div className="z-50 w-full shrink-0 border-b">
          <AppHeader user={session.user} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="relative flex flex-1 flex-col overflow-y-auto">
            {/* <ScrollArea className="flex-1"> */}
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4">{children}</main>
            {/* </ScrollArea> */}
            <div className="z-50 w-full shrink-0 border-t">
              <AppFooter />
            </div>
          </div>
        </div>
      </SidebarProvider>
      <CreateRepoDialog />
    </>
  );
}
