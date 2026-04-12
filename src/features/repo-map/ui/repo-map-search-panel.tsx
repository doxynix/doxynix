import React from "react";
import { useNodes, useReactFlow, type Node } from "@xyflow/react";
import { parseAsString, useQueryStates } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

import type { RepoMapNodeData } from "../model/repo-map-types";

export function RepoMapSearchPanel() {
  const { fitView, setNodes } = useReactFlow();
  const [params] = useQueryStates({ search: parseAsString.withDefault("") }, { shallow: true });
  const nodes = useNodes<Node<RepoMapNodeData>>();

  const lastQueryRef = React.useRef(params.search);

  React.useEffect(() => {
    const query = params.search.trim();
    const searchWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const matchingNodeIds = new Set(
      nodes
        .filter((node) => {
          if (!query) return true;
          const label = String(node.data.label).toLowerCase();
          const id = node.id.toLowerCase();
          const normalizedLabel = label.replaceAll(/\s+/g, "");
          const normalizedId = id.replaceAll(/\s+/g, "");

          return searchWords.every(
            (word) =>
              label.includes(word) ||
              id.includes(word) ||
              normalizedLabel.includes(word.replaceAll(/\s+/g, "")) ||
              normalizedId.includes(word.replaceAll(/\s+/g, ""))
          );
        })
        .map((n) => n.id)
    );

    const needsUpdate = nodes.some((node) => {
      const currentDim = node.data.repoMap?.dimBySearch ?? false;
      const targetDim = query === "" ? false : !matchingNodeIds.has(node.id);
      return currentDim !== targetDim;
    });

    if (needsUpdate) {
      setNodes((nds) =>
        nds.map((n) => {
          const shouldBeDimmed = query === "" ? false : !matchingNodeIds.has(n.id);

          const node = n as Node<RepoMapNodeData>;

          if ((node.data.repoMap?.dimBySearch ?? false) === shouldBeDimmed) return n;

          return {
            ...n,
            data: {
              ...node.data,
              repoMap: {
                ...node.data.repoMap,
                dimBySearch: shouldBeDimmed,
              },
            },
          };
        })
      );
    }

    if (query !== "" && matchingNodeIds.size > 0 && lastQueryRef.current !== params.search) {
      void fitView({
        duration: 400,
        maxZoom: 1.5,
        minZoom: 0.5,
        nodes: Array.from(matchingNodeIds).map((id) => ({ id })),
        padding: 0.3,
      });
    }

    lastQueryRef.current = params.search;
  }, [params.search, nodes, fitView, setNodes]);

  return (
    <div className="relative z-50 flex items-center">
      <AppSearch placeholder="Find..." />
    </div>
  );
}
