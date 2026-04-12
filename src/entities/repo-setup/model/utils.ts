import type { FileNode } from "./repo-setup.types";

export const sortNodes = (nodes: FileNode[]): FileNode[] => {
  return [...nodes]
    .sort((a, b) => {
      const aIsFolder = !!a.children;
      const bIsFolder = !!b.children;

      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map((node) => ({
      ...node,
      ...(node.children && node.children.length > 0 ? { children: sortNodes(node.children) } : {}),
    }));
};

export const collectAllIds = (node: FileNode, ids: string[] = []) => {
  ids.push(node.id);
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child != null) {
        collectAllIds(child, ids);
      }
    }
  }
  return ids;
};

export const getFolderSelectionState = (node: FileNode, selectedIds: Set<string>) => {
  if (!node.children || node.children.length === 0) {
    return selectedIds.has(node.id);
  }

  let totalCount = 0;
  let selectedCount = 0;

  const countDescendants = (currentNode: FileNode) => {
    if (!currentNode.children) return;

    for (let i = 0; i < currentNode.children.length; i++) {
      const child = currentNode.children[i];
      if (child == null) continue;
      totalCount++;

      if (selectedIds.has(child.id)) {
        selectedCount++;
      }

      countDescendants(child);
    }
  };

  countDescendants(node);

  if (selectedCount === 0) return false;
  if (selectedCount === totalCount) return true;
  return "indeterminate";
};
