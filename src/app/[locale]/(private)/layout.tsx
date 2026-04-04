import { type ReactNode } from "react";
import { cookies } from "next/headers";
import { unauthorized } from "next/navigation";

import { SidebarProvider } from "@/shared/ui/core/sidebar";
import { SentryUserIdentificator } from "@/shared/ui/kit/sentry-user-identificator";

import { CreateRepoDialog } from "@/features/repo";
import { GitInstallationCatcher } from "@/features/repo-setup";

import { AppFooter } from "@/widgets/app-footer";
import { AppHeader } from "@/widgets/app-header";
import { AppSidebar } from "@/widgets/app-sidebar";
import { HotkeyListeners } from "@/widgets/hotkey-manager";

import { getServerAuthSession } from "@/server/infrastructure/auth";

export default async function PrivateLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    unauthorized();
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <>
      <SentryUserIdentificator user={session.user} />
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="flex h-dvh w-full flex-col overflow-hidden"
      >
        <div className="z-50 w-full shrink-0 border-b">
          <AppHeader />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="relative flex flex-1 flex-col overflow-y-auto">
            {/* <ScrollArea className="flex-1"> */}
            <main className="mx-auto flex w-full max-w-400 flex-1 flex-col p-4">{children}</main>
            {/* </ScrollArea> */}
            <div className="z-50 w-full shrink-0 border-t">
              <AppFooter />
            </div>
          </div>
        </div>
        <HotkeyListeners />
      </SidebarProvider>
      <CreateRepoDialog />
      <GitInstallationCatcher />
    </>
  );
}
