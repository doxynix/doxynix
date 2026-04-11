import type { Node } from "@xyflow/react";

import type { RepoMapNodeData } from "./repo-map-types";

export interface ParentNodeConfig {
  children: string[];
  id: string;
  label: string;
}

export function extractParentGroups(nodes: Node<RepoMapNodeData>[]): ParentNodeConfig[] {
  const parentMap = new Map<string, Set<string>>();

  nodes.forEach((node) => {
    const parts = node.id.split(":");
    if (parts[0] === "group" && parts.length >= 2) {
      const groupPath = parts.slice(1).join(":");
      const parentPath = groupPath.split("/").slice(0, -1).join("/");

      let childrenSet = parentMap.get(parentPath);

      if (childrenSet == null) {
        childrenSet = new Set<string>();
        parentMap.set(parentPath, childrenSet);
      }

      childrenSet.add(node.id);
    }
  });

  return Array.from(parentMap.entries()).map(([id, children]) => ({
    children: Array.from(children),
    id: `parent-${id}`,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  }));
}

export function enrichNodesWithParents(
  nodes: Node<RepoMapNodeData>[],
  parents: ParentNodeConfig[]
): Node<RepoMapNodeData>[] {
  const createParentNode = (parent: ParentNodeConfig): Node<RepoMapNodeData> => {
    const baseData = nodes[0]?.data;
    return {
      data: {
        ...baseData,
        id: parent.id,
        itemCount: parent.children.length,
        label: parent.label,
        score: 0,
      } as RepoMapNodeData,
      id: parent.id,
      position: { x: 0, y: 0 },
      style: {
        opacity: 0,
      },
      type: "repoNode",
    };
  };

  const parentNodes = parents.map(createParentNode);
  const childToParent = new Map<string, string>();
  parents.forEach((p) => {
    p.children.forEach((childId) => childToParent.set(childId, p.id));
  });

  const enrichedNodes = nodes.map((node) => {
    return {
      ...node,
      parentId: childToParent.get(node.id),
    };
  });

  return [...parentNodes, ...enrichedNodes];
}
