import type { TreeApi } from "react-arborist";
import { create } from "zustand";

import type { FileNode } from "@/entities/repo-setup";

type RepoCodeState = {
  actions: {
    setTreeApi: (api: TreeApi<FileNode> | undefined) => void;
  };
  treeApi: TreeApi<FileNode> | undefined;
};

const useStore = create<RepoCodeState>((set) => ({
  actions: {
    setTreeApi: (api) => set({ treeApi: api }),
  },
  treeApi: undefined,
}));

export const useRepoTreeApi = () => useStore((s) => s.treeApi);
export const useRepoCodeActions = () => useStore((s) => s.actions);
