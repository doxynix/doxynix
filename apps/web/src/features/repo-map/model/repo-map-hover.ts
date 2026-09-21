import type { Edge, Node } from "@xyflow/react";

import type { RepoMapDisplayData, RepoMapNodeData } from "./repo-map.types";

export const FILTER_CONFIG = {
  api: { color: "bg-info", labelKey: "repo_map_filter_api" },
  client: { color: "bg-warning", labelKey: "repo_map_filter_client" },
  entrypoints: { color: "bg-destructive", labelKey: "repo_map_filter_entry" },
  server: { color: "bg-success", labelKey: "repo_map_filter_server" },
  shared: { color: "bg-foreground", labelKey: "repo_map_filter_shared" },
} as const;

export type FilterKey = keyof typeof FILTER_CONFIG;

export function applyEdgeHover(edges: Edge[], hoveredNodeId: null | string): Edge[] {
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

export function enrichRepoMapNodes(
  flowNodes: Node<RepoMapNodeData>[],
  options: {
    data: RepoMapDisplayData;
    highlightKey: FilterKey | null;
    hoveredNodeId: null | string;
    rawEdges: undefined | { source: string; target: string }[];
  },
): Node<RepoMapNodeData>[] {
  const { data, highlightKey, hoveredNodeId, rawEdges } = options;

  const hoveredCluster = new Set<string>();
  if (hoveredNodeId != null) {
    hoveredCluster.add(hoveredNodeId);
    rawEdges?.forEach((e) => {
      if (e.source === hoveredNodeId) {
        hoveredCluster.add(e.target);
      }
      if (e.target === hoveredNodeId) {
        hoveredCluster.add(e.source);
      }
    });
  }
  const highlightOn = hoveredCluster.size > 0;

  let filterAllowed: null | Set<string> = null;
  if (highlightKey && "filters" in data) {
    const list = data.filters[highlightKey];
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
