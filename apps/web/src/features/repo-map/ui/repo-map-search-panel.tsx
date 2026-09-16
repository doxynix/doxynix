import { useEffect, useRef } from "react";
import { type Node, useNodes, useReactFlow } from "@xyflow/react";
import { parseAsString, useQueryStates } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

import { computeShouldDim, matchRepoMapNodes } from "../model/match-repo-map-nodes";
import type { RepoMapNodeData } from "../model/repo-map.types";

export function RepoMapSearchPanel() {
  const { fitView, setNodes } = useReactFlow();
  const [params] = useQueryStates({ search: parseAsString.withDefault("") });
  const nodes = useNodes<Node<RepoMapNodeData>>();

  const lastQueryRef = useRef(params.search);

  useEffect(() => {
    const query = params.search.trim();

    const matchingNodeIds = matchRepoMapNodes(nodes, query);

    const needsUpdate = nodes.some((node) => {
      const currentDim = node.data.repoMap?.dimBySearch ?? false;
      const targetDim = computeShouldDim(node.id, query, matchingNodeIds);
      return currentDim !== targetDim;
    });

    if (needsUpdate) {
      setNodes((nds) =>
        nds.map((n) => {
          const shouldBeDimmed = computeShouldDim(n.id, query, matchingNodeIds);

          const node = n as Node<RepoMapNodeData>;

          if ((node.data.repoMap?.dimBySearch ?? false) === shouldBeDimmed) {
            return n;
          }

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
        }),
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
