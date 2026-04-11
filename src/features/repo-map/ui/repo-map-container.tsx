"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import { FileText } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { trpc, type RepoMapDisplayData } from "@/shared/api/trpc";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { RepoAnalyzeButton, useRepoParams } from "@/entities/repo";

import { RepoMapHotkeyListeners } from "./repo-map-hotkey-listeners";

type Props = { id: string };

const RepoMap = dynamic(() => import("./repo-map").then((m) => m.RepoMap), {
  loading: () => <Skeleton className="h-180 w-full" />,
  ssr: false,
});

export function RepoMapContainer({ id }: Readonly<Props>) {
  const { name, owner } = useRepoParams();

  const [viewId, setViewId] = useQueryState("view", parseAsString.withOptions({ shallow: true }));
  const [selectedId, setSelectedId] = useQueryState(
    "node",
    parseAsString.withOptions({ shallow: true })
  );
  const [filter, setFilter] = useQueryState("filter", parseAsString.withOptions({ shallow: true }));

  const [displayData, setDisplayData] = useState<RepoMapDisplayData | null>(null);

  const { data: mapData, isFetching: isMapFetching } = trpc.repoDetails.getStructureMap.useQuery(
    { repoId: id },
    { enabled: viewId == null }
  );

  const { data: nodeData, isFetching: isNodeFetching } = trpc.repoDetails.getStructureNode.useQuery(
    { nodeId: viewId ?? "", repoId: id },
    { enabled: viewId != null }
  );

  function navigateMap(nextId: string | null) {
    if (nextId == null) {
      void setViewId(null);
      void setSelectedId(null);
      return;
    }

    const knownNodeType =
      displayData != null && "children" in displayData
        ? displayData.children.find((c) => c.id === nextId || c.path === nextId)?.nodeType
        : null;

    const isFile =
      nextId.startsWith("file:") ||
      knownNodeType === "file" ||
      (!knownNodeType && nextId.split("/").pop()?.includes("."));

    if (isFile === true) {
      const formattedId = nextId.startsWith("file:") ? nextId : `file:${nextId}`;
      void setSelectedId(formattedId);

      const path = formattedId.split(":")[1] ?? "";
      const segments = path.split("/");

      if (segments.length > 1) {
        const parentFolder = `group:${segments.slice(0, -1).join("/")}`;
        if (viewId !== parentFolder) {
          void setViewId(parentFolder);
        }
      } else if (viewId !== null) {
        void setViewId(null);
      }
    } else {
      const formattedId = nextId.startsWith("group:") ? nextId : `group:${nextId}`;
      void setViewId(formattedId);
      void setSelectedId(null);
    }
  }

  const currentData = viewId == null ? mapData : nodeData;
  const isFetching = viewId == null ? isMapFetching : isNodeFetching;

  React.useEffect(() => {
    if (currentData != null) {
      setDisplayData(currentData);
    } else if (!isFetching && currentData === null) {
      setDisplayData(null);
    }
  }, [currentData, isFetching]);

  if (displayData == null && isFetching) {
    return <Skeleton className="h-180 w-full" />;
  }

  if (displayData == null && !isFetching) {
    if (viewId == null) {
      return (
        <div className="flex h-150 items-center justify-center rounded-xl border border-dashed">
          <EmptyState
            action={<RepoAnalyzeButton name={name} owner={owner} />}
            description="Run AI analysis to automatically generate map."
            icon={FileText}
            title="No map generated"
          />
        </div>
      );
    }
    return <p>Failed to load map data for this folder</p>;
  }

  if (displayData == null) return null;

  return (
    <ReactFlowProvider>
      <RepoMapHotkeyListeners />
      <div className="relative h-full w-full">
        <div className={isFetching ? "opacity-50 transition-opacity" : "transition-opacity"}>
          <RepoMap
            activeFilter={filter}
            activeNodeId={viewId}
            data={displayData}
            repoId={id}
            selectedNodeId={selectedId}
            onFilterChange={(val) => void setFilter(val)}
            onNavigate={navigateMap}
            onSelect={(val) => void setSelectedId(val)}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
