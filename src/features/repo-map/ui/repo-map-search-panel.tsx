import React from "react";
import { useReactFlow } from "@xyflow/react";
import { parseAsString, useQueryStates } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

export function RepoMapSearchPanel() {
  const { fitView, getNodes, setNodes } = useReactFlow();
  const [params] = useQueryStates({ search: parseAsString.withDefault("") }, { shallow: true });

  React.useEffect(() => {
    const nodes = getNodes();
    const query = params.search;

    if (!query.trim()) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            repoMap: {
              ...(n.data.repoMap ?? {}),
              dimBySearch: false,
            },
          },
        }))
      );
      return;
    }

    const searchWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const matchingNodeIds = new Set(
      nodes
        .filter((node) => {
          const label = String(node.data.label ?? "").toLowerCase();
          const id = node.id.toLowerCase();

          const normalizedLabel = label.replace(/\s+/g, "");
          const normalizedId = id.replace(/\s+/g, "");

          return searchWords.every(
            (word) =>
              label.includes(word) ||
              id.includes(word) ||
              normalizedLabel.includes(word.replace(/\s+/g, "")) ||
              normalizedId.includes(word.replace(/\s+/g, ""))
          );
        })
        .map((n) => n.id)
    );

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          repoMap: {
            ...(n.data.repoMap ?? {}),
            dimBySearch: !matchingNodeIds.has(n.id),
          },
        },
      }))
    );

    if (matchingNodeIds.size > 0) {
      void fitView({
        duration: 400,
        maxZoom: 1.5,
        minZoom: 0.5,
        nodes: Array.from(matchingNodeIds).map((id) => ({ id })),
        padding: 0.3,
      });
    }
  }, [params.search, fitView, getNodes, setNodes]);

  return (
    <div className="relative z-50 flex items-center">
      <AppSearch placeholder="Find..." />
    </div>
  );
}
