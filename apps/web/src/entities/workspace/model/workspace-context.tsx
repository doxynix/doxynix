"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { RouterOutput } from "@/shared/api/trpc";
import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";
import {
  clearWorkspaceCookie,
  getWorkspaceCookie,
  setWorkspaceCookie,
} from "@/shared/lib/workspace-cookie";
import { Spinner } from "@/shared/ui/core/spinner";

export type WorkspaceSummary = RouterOutput["workspace"]["myWorkspaces"]["items"][number];

type WorkspaceContextValue = {
  activeWorkspace: WorkspaceSummary | undefined;
  activeWorkspaceId: string;
  isOwner: boolean;
  items: WorkspaceSummary[];
  switchWorkspace: (workspaceId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// A repo route belongs to the old workspace; the new one may not contain it, and refreshing
// would render a 404. Send the user to the new workspace's dashboard instead.
function leaveRepoRoute(router: ReturnType<typeof useRouter>): boolean {
  // `window` on purpose: called from an effect, so reading it adds no dependency.
  if (!window.location.pathname.includes("/dashboard/repo/")) {
    return false;
  }

  router.replace("/dashboard");
  return true;
}

export function WorkspaceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const { data, isLoading } = useQuery(trpc.workspace.myWorkspaces.queryOptions());

  useEffect(() => {
    if (data == null) {
      return;
    }

    const cookie = getWorkspaceCookie();

    if (data.reset) {
      clearWorkspaceCookie();
      setWorkspaceCookie(data.activeWorkspaceId);
      queryClient.clear();
      toast.info(t("workspace_reset_notice"));
      leaveRepoRoute(router);
      return;
    }

    if (cookie == null) {
      setWorkspaceCookie(data.activeWorkspaceId);
      return;
    }

    if (!data.items.some((workspace) => workspace.id === cookie)) {
      setWorkspaceCookie(data.activeWorkspaceId);
      queryClient.clear();
      leaveRepoRoute(router);
    }
  }, [data, queryClient, router, t]);

  const switchWorkspace = (workspaceId: string) => {
    if (data == null || workspaceId === data.activeWorkspaceId) {
      return;
    }

    setWorkspaceCookie(workspaceId);
    queryClient.clear();
    toast.success(t("workspace_switch_toast"));
    if (leaveRepoRoute(router)) {
      return;
    }
    // The server tree was rendered with the previous cookie: without a refresh the page keeps
    // showing the old workspace until a full reload.
    router.refresh();
  };

  if (isLoading || data == null) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const activeWorkspace = data.items.find((workspace) => workspace.id === data.activeWorkspaceId);

  const value: WorkspaceContextValue = {
    activeWorkspace,
    activeWorkspaceId: data.activeWorkspaceId,
    isOwner: activeWorkspace?.role === "OWNER",
    items: data.items,
    switchWorkspace,
  };

  // oxlint-disable-next-line react/jsx-no-constructed-context-values -- React Compiler memoizes the value, so the rule is obsolete here.
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (context == null) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return context;
}
