import type { FileNode, FileTuple } from "./repo-setup.types";

export const sortNodes = (nodes: FileNode[]): FileNode[] => {
  return nodes
    .toSorted((a, b) => {
      const aIsFolder = !a.children;
      const bIsFolder = !b.children;

      if (aIsFolder !== bIsFolder) {
        return aIsFolder ? -1 : 1;
      }

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

export const getRecommendedPaths = (files: FileTuple[] | undefined) => {
  if (files == null) {
    return [];
  }
  return files.filter((f) => f[3] === 1 && f[1] === 1).map((f) => f[0]);
};

export const buildFileTree = (files: FileTuple[] | undefined): FileNode[] => {
  if (files == null) {
    return [];
  }

  const root: FileNode[] = [];
  const map = new Map<string, FileNode>();

  files.forEach((fileArr) => {
    const [path, type, sha, recommended] = fileArr;
    const parts = path.split("/");
    let currentPath = "";

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const newNode: FileNode = {
          children: isLast ? undefined : [],
          id: currentPath,
          name: part,
          path: currentPath,
          recommended: isLast ? recommended === 1 : false,
          sha: isLast ? sha : "",
          type: isLast ? (type === 1 ? "blob" : "tree") : "tree",
        };
        map.set(currentPath, newNode);
        if (index === 0) {
          root.push(newNode);
        } else {
          const parent = map.get(parentPath);
          if (parent?.children) {
            parent.children.push(newNode);
          }
        }
      }
    });
  });

  return sortNodes(root);
};

export const countSelectedFiles = (selectedIds: Set<string>, files: FileTuple[] | undefined) => {
  if (files == null) {
    return 0;
  }

  const allFilePaths = new Set(files.filter((f) => f[1] === 1).map((f) => f[0]));
  let count = 0;
  selectedIds.forEach((id) => {
    if (allFilePaths.has(id)) {
      count++;
    }
  });
  return count;
};

export const matchesSearch = (term: string, files: FileTuple[] | undefined) => {
  if (!term) {
    return true;
  }

  const normalizedTerm = term.toLowerCase();
  return files?.some((f) => f[0].toLowerCase().includes(normalizedTerm));
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
    if (!currentNode.children) {
      return;
    }

    for (let i = 0; i < currentNode.children.length; i++) {
      const child = currentNode.children[i];
      if (child == null) {
        continue;
      }
      totalCount++;

      if (selectedIds.has(child.id)) {
        selectedCount++;
      }

      countDescendants(child);
    }
  };

  countDescendants(node);

  if (selectedCount === 0) {
    return false;
  }
  if (selectedCount === totalCount) {
    return true;
  }
  return "indeterminate";
};
