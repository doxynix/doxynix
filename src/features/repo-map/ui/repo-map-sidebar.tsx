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
  const { data: briefData, isLoading: isBriefLoading } =
    trpc.repoDetails.getInteractiveBrief.useQuery({ repoId });

  const { data: nodeBrief, isLoading: isNodeBriefLoading } =
    trpc.repoDetails.getInteractiveBriefNode.useQuery(
      { nodeId: nodeId ?? "", repoId },
      { enabled: nodeId != null }
    );

  return (
    <aside className="bg-card flex h-full flex-col overflow-hidden">
      {nodeId == null && isBriefLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeId == null && briefData != null ? (
        <RepoMapOverview brief={briefData} onNavigate={onNavigate} />
      ) : nodeId != null && isNodeBriefLoading ? (
        <RepoMapSidebarSkeleton />
      ) : nodeBrief != null ? (
        <RepoNodeInspector data={nodeBrief} onClose={onClose} onNavigate={onNavigate} />
      ) : null}
    </aside>
  );
}
