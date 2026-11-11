import { useEffect, useRef, useState } from "react";

import type { FileNode, FileTuple } from "./repo-setup.types";
import {
  collectAllIds,
  collectTreeIds,
  countSelectedFiles,
  getFolderSelectionState,
  getRecommendedPaths,
} from "./repo-setup-utils";

type Options = {
  branch: string;
  files: FileTuple[] | undefined;
  selectRecommendedOnLoad?: boolean;
  treeData: FileNode[];
};

export function useRepoSelection({ branch, files, selectRecommendedOnLoad, treeData }: Options) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prevBranch, setPrevBranch] = useState(branch);
  const initializedRef = useRef(false);

  if (branch !== prevBranch && files) {
    setSelectedIds(new Set(getRecommendedPaths(files)));
    setPrevBranch(branch);
  }

  useEffect(() => {
    if (selectRecommendedOnLoad !== true || initializedRef.current || files == null) {
      return;
    }

    initializedRef.current = true;
    setSelectedIds(new Set(getRecommendedPaths(files)));
  }, [files, selectRecommendedOnLoad]);

  const toggleSelection = (_nodeId: string, nodeData: FileNode) => {
    const idsToToggle = collectAllIds(nodeData);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      const state = getFolderSelectionState(nodeData, prev);
      const isCurrentlySelected = state === true || state === "indeterminate";

      for (const id of idsToToggle) {
        if (isCurrentlySelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }

      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(collectTreeIds(treeData)));
  const clearAll = () => setSelectedIds(new Set());
  const selectRecommended = () => setSelectedIds(new Set(getRecommendedPaths(files)));

  return {
    clearAll,
    selectAll,
    selectedFilesCount: countSelectedFiles(selectedIds, files),
    selectedIds,
    selectRecommended,
    toggleSelection,
  };
}
