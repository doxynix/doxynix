"use client";

import { trpc } from "@/shared/api/trpc";

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
  const { data: workspace, isLoading: isWorkspaceLoading } = trpc.repoDetails.getWorkspace.useQuery(
    { repoId }
  );

  const { data: nodeContext, isLoading: isNodeContextLoading } =
    trpc.repoDetails.getNodeContext.useQuery(
      { nodeId: nodeId ?? "", repoId },
      { enabled: nodeId != null }
    );

  return (
    <aside className="bg-card flex h-full flex-col overflow-hidden">
      {nodeId == null && isWorkspaceLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeId == null && workspace != null ? (
        <RepoMapOverview workspace={workspace} onNavigate={onNavigate} />
      ) : nodeId != null && isNodeContextLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeContext != null ? (
        <RepoNodeInspector data={nodeContext} onClose={onClose} onNavigate={onNavigate} />
      ) : null}
    </aside>
  );
}
