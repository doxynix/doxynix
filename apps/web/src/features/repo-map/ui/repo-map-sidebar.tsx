"use client";
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

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-card">
      {nodeId == null && isWorkspaceLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeId == null && workspace != null ? (
        <RepoMapOverview
          onNavigate={onNavigate}
          workspace={workspace}
        />
      ) : nodeId != null && isNodeContextLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeContext != null ? (
        <RepoNodeInspector
          data={nodeContext}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      ) : null}
    </aside>
  );
}
