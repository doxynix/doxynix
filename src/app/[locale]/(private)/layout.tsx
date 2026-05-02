import { type ReactNode } from "react";
import { cookies } from "next/headers";
import { unauthorized } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/shared/ui/core/sidebar";
import { SentryUserIdentificator } from "@/shared/ui/kit/sentry-user-identificator";

import { CreateRepoDialog } from "@/features/repo/ui/create-repo-dialog";

import { AppFooter } from "@/widgets/app-footer/ui/app-footer";
import { AppHeader } from "@/widgets/app-header/ui/app-header";
import { AppSidebar } from "@/widgets/app-sidebar/ui/app-sidebar";
import { GithubConnectionFeedback } from "@/widgets/dashboard/ui/github-connection-feedback";
import { HotkeyListeners } from "@/widgets/hotkey-manager/ui/hotkey-listeners";

import { getServerAuthSession } from "@/server/shared/infrastructure/auth";

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
            <SidebarInset id="main-content" tabIndex={-1} className="mx-auto max-w-400 p-4">
              {children}
            </SidebarInset>
            {/* </ScrollArea> */}
            <div className="z-50 w-full shrink-0 border-t">
              <AppFooter />
            </div>
          </div>
        </div>
        <HotkeyListeners />
      </SidebarProvider>
      <GithubConnectionFeedback />
      <CreateRepoDialog />
    </>
  );
}
