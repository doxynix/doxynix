"use client";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/shared/api/trpc";

import { useNodeContext } from "@/entities/repo/model/use-node-context";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { RepoMapOverview } from "./repo-map-overview";
import { RepoMapSidebarSkeleton } from "./repo-map-sidebar-skeleton";
import { RepoNodeInspector } from "./repo-node-inspector";

type Props = {
  nodeId: null | string;
  onClose: () => void;
  onNavigate: (id: null | string) => void;
  repoId: string;
};

export function RepoMapSidebar({ nodeId, onClose, onNavigate, repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const shouldLoadWorkspace = nodeId == null || nodeId.length === 0;
  const { aid } = useRepoParams();

  const { data: workspace, isLoading: isWorkspaceLoading } = useQuery(
    trpc.analysis.getWorkspace.queryOptions(
      { aid: aid ?? undefined, repoId },
      { enabled: shouldLoadWorkspace },
    ),
  );

  const { data: nodeContext, isLoading: isNodeContextLoading } = useNodeContext({
    aid: aid ?? undefined,
    nodeId,
    repoId,
  });

  let body: ReactNode = null;

  if (nodeId == null && isWorkspaceLoading) {
    body = <RepoMapSidebarSkeleton />;
  } else if (nodeId == null && workspace != null) {
    body = (
      <RepoMapOverview
        onNavigate={onNavigate}
        workspace={workspace}
      />
    );
  } else if (nodeId != null && isNodeContextLoading) {
    body = <RepoMapSidebarSkeleton />;
  } else if (nodeContext != null) {
    body = (
      <RepoNodeInspector
        data={nodeContext}
        onClose={onClose}
        onNavigate={onNavigate}
      />
    );
  }

  return <aside className="flex h-full flex-col overflow-hidden bg-card">{body}</aside>;
}
