"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  Background,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import type { RepoMapDisplayData } from "@/shared/api/trpc";

import "@xyflow/react/dist/style.css";

import { FilterIcon, SlashIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";

import { useMapControlsHide } from "@/entities/repo-map";

import type { RepoMapNodeData } from "../model/repo-map-types";
import { useMapLayout } from "../model/use-map-layout";
import { enrichNodesWithParents, extractParentGroups } from "../model/use-parent-groups";
import { RepoMapCustomControls } from "./repo-map-custom-controls";
import { ExportPanel } from "./repo-map-export-panel";
import { RepoMapSearchPanel } from "./repo-map-search-panel";
import { RepoMapSidebar } from "./repo-map-sidebar";
import { RepoNode } from "./repo-node";

const nodeTypes = {
  repoNode: RepoNode,
};

const FILTER_CONFIG = {
  api: { color: "bg-info", label: "api" },
  client: { color: "bg-warning", label: "client" },
  entrypoints: { color: "bg-destructive", label: "entry" },
  server: { color: "bg-success", label: "server" },
  shared: { color: "bg-foreground", label: "shared" },
} as const;

type FilterKey = keyof typeof FILTER_CONFIG;

function applyEdgeHover(edges: Edge[], hoveredNodeId: null | string): Edge[] {
  return edges.map((edge) => {
    const rel = (edge.data as undefined | { relation?: string })?.relation;
    const isCycle = rel === "cycle";
    const isEdgeActive =
      hoveredNodeId == null || edge.source === hoveredNodeId || edge.target === hoveredNodeId;
    return {
      ...edge,
      animated: Boolean(isCycle || (hoveredNodeId != null && edge.source === hoveredNodeId)),
      style: {
        ...edge.style,
        opacity: isEdgeActive ? 1 : 0.05,
        transition: "opacity 0.3s ease-in-out",
      },
    };
  });
}

function enrichRepoMapNodes(
  flowNodes: Node<RepoMapNodeData>[],
  options: {
    data: RepoMapDisplayData;
    highlightKey: FilterKey | null;
    hoveredNodeId: null | string;
    rawEdges: undefined | { source: string; target: string }[];
  }
): Node<RepoMapNodeData>[] {
  const { data, highlightKey, hoveredNodeId, rawEdges } = options;

  const hoveredCluster = new Set<string>();
  if (hoveredNodeId != null) {
    hoveredCluster.add(hoveredNodeId);
    rawEdges?.forEach((e) => {
      if (e.source === hoveredNodeId) hoveredCluster.add(e.target);
      if (e.target === hoveredNodeId) hoveredCluster.add(e.source);
    });
  }
  const highlightOn = hoveredCluster.size > 0;

  let filterAllowed: null | Set<string> = null;
  if (highlightKey && "filters" in data) {
    const list = data.filters[highlightKey as keyof typeof data.filters];
    if (Array.isArray(list) && list.length > 0) {
      filterAllowed = new Set(list);
    }
  }

  return flowNodes.map((node) => {
    const isHoverActive = highlightOn && hoveredCluster.has(node.id);
    const dimByHover = highlightOn && !isHoverActive;
    const dimByFilter = Boolean(filterAllowed && !filterAllowed.has(node.id));
    const dimBySearch = node.data.repoMap?.dimBySearch ?? false;

    return {
      ...node,
      data: {
        ...node.data,
        repoMap: { dimByFilter, dimByHover, dimBySearch },
      },
    };
  });
}

type Props = {
  activeFilter: null | string;
  activeNodeId: null | string;
  data: NonNullable<RepoMapDisplayData>;
  onFilterChange: (key: null | string) => void;
  onNavigate: (id: null | string) => void;
  onSelect: (id: null | string) => void;
  repoId: string;
  selectedNodeId: null | string;
};

export function RepoMap({
  activeFilter,
  activeNodeId,
  data,
  onFilterChange,
  onNavigate,
  onSelect,
  repoId,
  selectedNodeId,
}: Readonly<Props>) {
  const { resolvedTheme } = useTheme();
  const { fitView } = useReactFlow();
  const {
    edges,
    layoutReady,
    layoutTick,
    nodes: baseNodes,
    onEdgesChange,
    onNodesChange,
    setEdges,
  } = useMapLayout(data);

  const hide = useMapControlsHide();

  const [hoveredNodeId, setHoveredNodeId] = useState<null | string>(null);

  const viewKey = activeNodeId ?? "root";
  const rawEdges = "graph" in data ? data.graph.edges : data.edges;

  const parentGroups = extractParentGroups(baseNodes);
  const nodes = enrichNodesWithParents(baseNodes, parentGroups);

  const displayNodes = enrichRepoMapNodes(nodes, {
    data,
    highlightKey: activeFilter as FilterKey | null,
    hoveredNodeId,
    rawEdges,
  });

  const displayEdges = edges.map((edge) => ({
    ...edge,
    focusable: true,
    selectable: true,
  }));

  useEffect(() => {
    if (!layoutReady) return;
    const id = requestAnimationFrame(() => {
      void fitView({ duration: viewKey === "root" ? 400 : 540, padding: 0.22 });
    });
    return () => cancelAnimationFrame(id);
  }, [layoutTick, layoutReady, viewKey, fitView]);

  useEffect(() => {
    if (!layoutReady) return;
    setEdges((eds) => applyEdgeHover(eds, hoveredNodeId));
  }, [hoveredNodeId, layoutReady, setEdges]);

  useEffect(() => {
    if (selectedNodeId != null && layoutReady) {
      void fitView({
        duration: 400,
        nodes: [{ id: selectedNodeId }],
        padding: 1,
      });
    }
  }, [selectedNodeId, layoutReady, fitView]);

  const onNodeClick = (_: MouseEvent, node: Node<RepoMapNodeData>) => {
    onSelect(node.id);
  };

  const onNodeDoubleClick = (_: MouseEvent, node: Node<RepoMapNodeData>) => {
    const isGroup = node.id.startsWith("group:");

    if (isGroup) {
      onNavigate(node.id);
    }
  };

  const rawBreadcrumbs = "breadcrumbs" in data ? data.breadcrumbs : [];
  const breadcrumbItems = rawBreadcrumbs.map((crumb) => {
    const segments = crumb.path.split("/").filter(Boolean);
    const cleanLabel = segments.at(-1) ?? crumb.label;

    return {
      label: cleanLabel,
      onClick: () => onNavigate(crumb.id),
    };
  });

  return (
    <div className="relative flex h-[calc(100dvh-260px)] w-full flex-col overflow-hidden rounded-xl border">
      <div className="flex shrink-0 items-center justify-between p-3">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate(null)}
            className="h-5 cursor-pointer gap-1 bg-transparent text-xs hover:bg-transparent md:px-1"
          >
            Root
          </Button>

          {breadcrumbItems.length > 0 && (
            <AppBreadcrumbs
              showSeparatorAtStart
              items={breadcrumbItems}
              separator={<SlashIcon className="size-3 -rotate-12" />}
              className="hidden min-w-0 md:block"
            />
          )}
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="relative">
        <ResizablePanel defaultSize="70%" maxSize="100%" minSize="30%">
          <div className="relative h-full min-h-0 w-full">
            <div className="h-full min-h-0 w-full">
              <ReactFlow
                colorMode={resolvedTheme === "dark" ? "dark" : "light"}
                deleteKeyCode={null}
                edges={displayEdges}
                maxZoom={1.75}
                minZoom={0.1}
                nodes={displayNodes}
                nodesConnectable={false}
                nodesDraggable={layoutReady}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeMouseEnter={(_, n) => setHoveredNodeId(n.id)}
                onNodeMouseLeave={() => setHoveredNodeId(null)}
                onNodesChange={onNodesChange}
                onPaneClick={() => onSelect(null)}
              >
                <Panel
                  position="top-left"
                  className={cn(
                    "flex flex-col gap-2 transition-all duration-300",
                    hide
                      ? "pointer-events-none -translate-x-full opacity-0"
                      : "translate-x-0 opacity-100"
                  )}
                >
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    Quick Filters <FilterIcon className="size-3" />
                  </p>
                  <div className="flex items-center gap-2">
                    {(Object.keys(FILTER_CONFIG) as Array<keyof typeof FILTER_CONFIG>).map(
                      (key) => (
                        <Button
                          key={key}
                          size="sm"
                          variant="outline"
                          onClick={() => onFilterChange(activeFilter === key ? null : key)}
                          className={cn(
                            "bg-background justify-start gap-2 text-xs",
                            activeFilter === key ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          <div className={cn("size-2 rounded-full", FILTER_CONFIG[key].color)} />
                          {FILTER_CONFIG[key].label}
                        </Button>
                      )
                    )}
                  </div>
                  <RepoMapSearchPanel />
                </Panel>
                <Panel position="top-right" className="flex flex-col items-end gap-1">
                  <div
                    className={cn(
                      "transform transition-all duration-300",
                      hide
                        ? "pointer-events-none translate-x-full opacity-0"
                        : "translate-x-0 opacity-100"
                    )}
                  >
                    <ExportPanel filename="repo-map" />
                  </div>
                </Panel>
                <Background gap={25} />

                <div className={cn("transition-opacity duration-300")}>
                  <RepoMapCustomControls />
                  <MiniMap
                    nodeColor={(n: Node<RepoMapNodeData>) =>
                      n.data.markers.risk && n.data.stats.riskCount
                        ? "var(--status-error)"
                        : "var(--status-info)"
                    }
                  />
                </div>
              </ReactFlow>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="30%">
          <RepoMapSidebar
            nodeId={selectedNodeId}
            repoId={repoId}
            onClose={() => onSelect(null)}
            onNavigate={onNavigate}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
