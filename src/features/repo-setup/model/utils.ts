import { FileNode } from "@/shared/types/repo";

export const sortNodes = (nodes: FileNode[]): FileNode[] => {
  return nodes
    .sort((a, b) => {
      const aIsFolder = !!a.children;
      const bIsFolder = !!b.children;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((node) => {
      if (node.children) node.children = sortNodes(node.children);
      return node;
    });
};

export const collectAllIds = (node: FileNode, ids: string[] = []) => {
  ids.push(node.id);
  if (node.children) {
    node.children.forEach((child) => collectAllIds(child, ids));
  }
  return ids;
};

export const getFolderSelectionState = (node: FileNode, selectedIds: Set<string>) => {
  const allChildIds = collectAllIds(node).filter((id) => id !== node.id);
  if (allChildIds.length === 0) return selectedIds.has(node.id);

  const selectedChildren = allChildIds.filter((id) => selectedIds.has(id));

  if (selectedChildren.length === 0) return false;
  if (selectedChildren.length === allChildIds.length) return true;
  return "indeterminate";
};
