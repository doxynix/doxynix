"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { RouterOutput } from "@/shared/api/trpc";
import { useTRPC } from "@/shared/api/trpc";
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

export function WorkspaceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
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
      return;
    }

    if (cookie == null) {
      setWorkspaceCookie(data.activeWorkspaceId);
      return;
    }

    if (!data.items.some((workspace) => workspace.id === cookie)) {
      setWorkspaceCookie(data.activeWorkspaceId);
      queryClient.clear();
    }
  }, [data, queryClient, t]);

  const switchWorkspace = (workspaceId: string) => {
    setWorkspaceCookie(workspaceId);
    queryClient.clear();
    toast.success(t("workspace_switch_toast"));
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
