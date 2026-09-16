export type NodeConnectionsInput = {
  children: ReadonlyArray<{ id: string }>;
  explain: {
    nextSuggestedPaths: ReadonlyArray<string>;
    sourcePaths: ReadonlyArray<string>;
  };
  inspect: {
    relatedPaths: ReadonlyArray<string>;
    samplePaths: ReadonlyArray<string>;
  };
  node: {
    id: string;
    label: string;
    path: string;
    previewPaths: ReadonlyArray<string>;
  };
};

export function deriveNodeConnections(input: NodeConnectionsInput): {
  allFileReferences: Array<string | undefined>;
  connections: string[];
} {
  const { children, explain, inspect, node } = input;

  const allFileReferences = Array.from(
    new Set([...node.previewPaths, ...inspect.samplePaths, ...explain.sourcePaths]),
  )
    .map((path) => path.split("/").pop())
    .filter((name) => name !== node.label);

  const internalFileNames = new Set(allFileReferences);

  const childIds = new Set(children.map((c) => c.id));

  const uniqueNavigation = explain.nextSuggestedPaths.filter(
    (path) => path !== node.id && !childIds.has(path),
  );

  const uniqueRelated = inspect.relatedPaths.filter(
    (path) => path !== node.id && !childIds.has(path),
  );

  const connections = Array.from(new Set([...uniqueNavigation, ...uniqueRelated])).filter(
    (path) => {
      const fileName = path.split("/").pop();

      const isSelfId = path === node.id;
      const isSelfPath = path === node.path;
      const isSelfName = fileName === node.label;
      const isInternal = internalFileNames.has(fileName);

      return !isSelfId && !isSelfPath && !isSelfName && !isInternal;
    },
  );

  return { allFileReferences, connections };
}
