export type NodeLike = { data: { label: number | string }; id: string };

export function matchRepoMapNodes(nodes: NodeLike[], query: string): Set<string> {
  const searchWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return new Set(
    nodes
      .filter((node) => {
        if (!query) {
          return true;
        }

        const label = String(node.data.label).toLowerCase();
        const id = node.id.toLowerCase();
        const normalizedLabel = label.replaceAll(/\s+/g, "");
        const normalizedId = id.replaceAll(/\s+/g, "");

        return searchWords.every(
          (word) =>
            label.includes(word) ||
            id.includes(word) ||
            normalizedLabel.includes(word.replaceAll(/\s+/g, "")) ||
            normalizedId.includes(word.replaceAll(/\s+/g, "")),
        );
      })
      .map((node) => node.id),
  );
}

export function computeShouldDim(nodeId: string, query: string, matchingIds: Set<string>): boolean {
  return query === "" ? false : !matchingIds.has(nodeId);
}
