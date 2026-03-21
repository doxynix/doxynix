import type { TreeApi } from "react-arborist";
import { create } from "zustand";

import type { FileNode } from "@/entities/repo-setup";

type RepoCodeState = {
  actions: {
    setTreeApi: (api: TreeApi<FileNode> | undefined) => void;
  };

  treeApi: TreeApi<FileNode> | undefined;
};

export const useRepoCodeStore = create<RepoCodeState>((set) => ({
  actions: {
    setTreeApi: (api) =>
      set((state) => {
        if (state.treeApi === api) return state;
        return { treeApi: api };
      }),
  },

  treeApi: undefined,
}));

export const useRepoCodeActions = () => useRepoCodeStore((s) => s.actions);
