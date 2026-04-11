import { useEffect, useState } from "react";
import { useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";
import type { ElkNode } from "elkjs";
import ELK from "elkjs/lib/elk.bundled.js";

import type { RepoMapDisplayData } from "@/shared/api/trpc";

import type { RepoMapNodeData } from "./repo-map-types";
import { extractParentGroups } from "./use-parent-groups";

const elk = new ELK();

const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.edgeNodeLayer": "60",
  "elk.layered.spacing.nodeNodeLayer": "150",
  "elk.padding": "[top=100,left=50,bottom=50,right=50]",
  "elk.spacing.componentComponent": "150",
  "elk.spacing.nodeNode": "120",
};

interface ElkNodeWithChildren extends ElkNode {
  children?: ElkNode[];
}

export function useMapLayout(data: RepoMapDisplayData) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RepoMapNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const layoutSourceNodes = "graph" in data ? data.graph.nodes : data.children;
    const layoutSourceEdges = "graph" in data ? data.graph.edges : data.edges;

    const layoutNodes: Node<RepoMapNodeData>[] = layoutSourceNodes.map((n) => ({
      data: n,
      id: n.id,
      position: { x: 0, y: 0 },
      type: "repoNode",
    }));

    const layoutEdges: Edge[] = layoutSourceEdges.map((e) => {
      const isCycle = e.relation === "cycle";
      const isRisk = e.relation === "risk";
      return {
        animated: isCycle,
        data: { relation: e.relation },
        focusable: true,
        id: e.id,
        label: isCycle ? "cycle" : isRisk ? "risk" : undefined,
        labelBgBorderRadius: 4,
        labelBgPadding: [4, 2],
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.8 },
        labelStyle: {
          fill: isCycle || isRisk ? "var(--status-error)" : "#888",
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
        },
        selectable: true,
        source: e.source,
        style: {
          stroke: isRisk || isCycle ? "var(--status-error)" : "var(--border-strong)",
          strokeWidth: e.weight ? Math.min(Math.max(e.weight / 2, 1.5), 5) : 2,
          transition: "opacity 0.3s ease-in-out",
        },
        target: e.target,
        type: "smoothstep",
      };
    });

    const calculateLayout = async () => {
      if (!cancelled) setLayoutReady(false);

      if (layoutNodes.length === 0) {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
          setLayoutReady(true);
        }
        return;
      }

      const nodeIds = new Set(layoutNodes.map((n) => n.id));
      const parentGroups = extractParentGroups(layoutNodes);

      const validEdgesForElk = layoutEdges
        .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
        .map((e) => ({
          id: e.id,
          sources: [e.source],
          targets: [e.target],
        }));

      const parentElkNodes = parentGroups.map((parent) => ({
        children: parent.children.map((childId) => {
          const node = layoutNodes.find((n) => n.id === childId);
          return {
            height: 180 + Math.min(((node?.data.score as number) || 0) / 2, 30),
            id: childId,
            width: 320 + Math.min((node?.data.score as number) || 0, 60),
          };
        }),
        id: parent.id,
        layoutOptions: { "elk.padding": "[top=80,left=50,bottom=50,right=50]" },
      }));

      const standaloneNodes = layoutNodes
        .filter((n) => !parentGroups.some((p) => p.children.includes(n.id)))
        .map((n) => ({
          height: 120 + Math.min(((n.data.score as number) || 0) / 2, 30),
          id: n.id,
          width: 240 + Math.min((n.data.score as number) || 0, 60),
        }));

      const elkGraph = {
        children: [...parentElkNodes, ...standaloneNodes] as ElkNodeWithChildren[],
        edges: validEdgesForElk,
        id: "root",
        layoutOptions: elkOptions,
      };

      try {
        const layoutedGraph = (await elk.layout(elkGraph)) as ElkNodeWithChildren;
        if (cancelled) return;

        const nodePositions = new Map<string, { x: number; y: number }>();

        const extractPositions = (
          elkNodes: ElkNodeWithChildren[] | undefined,
          parentOffset: { x: number; y: number } = { x: 0, y: 0 }
        ): void => {
          if (!elkNodes) return;

          elkNodes.forEach((elkNode) => {
            const x = (elkNode.x ?? 0) + parentOffset.x;
            const y = (elkNode.y ?? 0) + parentOffset.y;
            nodePositions.set(elkNode.id, { x, y });

            if (elkNode.children && elkNode.children.length > 0) {
              extractPositions(elkNode.children as ElkNodeWithChildren[], { x, y });
            }
          });
        };

        extractPositions(layoutedGraph.children as ElkNodeWithChildren[] | undefined);

        const layoutedNodes = layoutNodes.map((node) => ({
          ...node,
          position: nodePositions.get(node.id) || { x: 0, y: 0 },
        }));

        setNodes(layoutedNodes);
        setEdges(layoutEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)));
        setLayoutReady(true);
        setLayoutTick((t) => t + 1);
      } catch (err) {
        if (!cancelled) {
          console.error("ELK Layout Error:", err);
          setNodes(layoutNodes);
          setEdges(layoutEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)));
          setLayoutReady(true);
        }
      }
    };

    void calculateLayout();
    return () => {
      cancelled = true;
    };
  }, [data, setEdges, setNodes]);

  return {
    edges,
    layoutReady,
    layoutTick,
    nodes,
    onEdgesChange,
    onNodesChange,
    setEdges,
    setNodes,
  };
}
