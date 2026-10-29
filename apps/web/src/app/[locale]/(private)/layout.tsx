import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { unauthorized } from "next/navigation";

import { REPO_LIST_PAGE_SIZE } from "@/shared/config/repos";
import { SidebarInset, SidebarProvider } from "@/shared/ui/core/sidebar";
import { SentryUserIdentificator } from "@/shared/ui/kit/sentry-user-identificator";

import { WorkspaceProvider } from "@/entities/workspace/model/workspace-context";

import { Agent } from "@/features/agent/ui/agent";
import { CreateRepoDialog } from "@/features/repo/ui/create-repo-dialog";
import { AppearanceSync } from "@/features/settings/ui/appearance/appearance-sync";

import { AppFooter } from "@/widgets/app-footer/ui/app-footer";
import { AppHeader } from "@/widgets/app-header/ui/app-header";
import { AppSidebar } from "@/widgets/app-sidebar/ui/app-sidebar";
import { GithubConnectionFeedback } from "@/widgets/dashboard/ui/github-connection-feedback";
import { HotkeyListeners } from "@/widgets/hotkey-manager/ui/hotkey-listeners";

import { auth } from "@/server/core/auth";
import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export default async function PrivateLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user == null) {
    unauthorized();
  }

  await Promise.all([
    prefetch(trpcProxy.workspace.myWorkspaces.queryOptions()),
    prefetch(trpcProxy.notification.getStats.queryOptions()),
    prefetch(trpcProxy.user.getAppearance.queryOptions({})),
    prefetch(
      trpcProxy.repo.getSlim.infiniteQueryOptions(
        { limit: REPO_LIST_PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.meta.nextCursor },
      ),
    ),
  ]);

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  const sidebarWidth = Number(cookieStore.get("sidebar_width")?.value);

  return (
    <>
      <SentryUserIdentificator user={session.user} />
      <HydrateClient>
        <WorkspaceProvider>
          <AppearanceSync />
          <SidebarProvider
            className="flex h-dvh w-full flex-col overflow-hidden"
            defaultOpen={defaultOpen}
            defaultWidth={sidebarWidth > 0 ? sidebarWidth : undefined}
          >
            <div className="z-50 w-full shrink-0 border-b">
              <AppHeader />
            </div>

            <div className="flex flex-1 overflow-hidden">
              <AppSidebar />
              <div className="relative flex flex-1 flex-col overflow-y-auto">
                {/* <ScrollArea className="flex-1"> */}
                <SidebarInset
                  className="mx-auto max-w-400 p-4"
                  id="main-content"
                  tabIndex={-1}
                >
                  {children}
                </SidebarInset>
                {/* </ScrollArea> */}
                <div className="z-50 w-full shrink-0 border-t">
                  <AppFooter />
                </div>
              </div>
            </div>
            <HotkeyListeners />
            <Agent />
          </SidebarProvider>
        </WorkspaceProvider>
      </HydrateClient>
      <GithubConnectionFeedback />
      <CreateRepoDialog />
    </>
  );
}
