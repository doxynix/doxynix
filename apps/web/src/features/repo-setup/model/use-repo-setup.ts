import { useState } from "react";
import type { DocType } from "@doxynix/shared";
import type { TreeApi } from "react-arborist";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import type { FileNode } from "@/entities/repo/model/repo-setup.types";
import { useRepoBranch, useRepoBranches } from "@/entities/repo/model/use-repo-branch";
import { useRepoSelection } from "@/entities/repo/model/use-repo-selection";
import { useRepoTreeData } from "@/entities/repo/model/use-repo-tree-data";

import { useRepoAnalysisLaunch } from "./use-repo-analysis-launch";

type Options = {
  initialDocTypes?: DocType[];
  selectRecommendedOnLoad?: boolean;
};

export function useRepoSetup(repo: UiRepoDetailed, options?: Options) {
  const { branch: selectedBranch, setBranch: setSelectedBranch } = useRepoBranch(repo);
  const { branches, isBranchesLoading } = useRepoBranches(repo);
  const { files, hasSearchMatches, isLoading, searchTerm, setSearchTerm, treeData } =
    useRepoTreeData(repo, selectedBranch);
  const selection = useRepoSelection({
    branch: selectedBranch,
    files,
    selectRecommendedOnLoad: options?.selectRecommendedOnLoad,
    treeData,
  });
  const launch = useRepoAnalysisLaunch({
    branch: selectedBranch,
    files,
    initialDocTypes: options?.initialDocTypes,
    repo,
    selectedIds: selection.selectedIds,
  });

  const [treeApi, setTreeApi] = useState<null | TreeApi<FileNode>>(null);

  return {
    actions: {
      handleClearAll: selection.clearAll,
      handleSelectAll: selection.selectAll,
      handleSelectRecommended: selection.selectRecommended,
      handleStartAnalysis: launch.start,
      handleToggleSelection: selection.toggleSelection,
      resetAnalysisError: launch.resetAnalysisError,
      setAnalysisLocale: launch.setAnalysisLocale,
      setInstructions: launch.setInstructions,
      setSearchTerm,
      setSelectedBranch,
      setTreeApi,
      toggleDocType: launch.toggleDocType,
    },
    refs: {
      treeApi,
    },
    state: {
      analysisLocale: launch.analysisLocale,
      branches,
      error: launch.error,
      hasSearchMatches,
      instructions: launch.instructions,
      isBranchesLoading,
      isLoading,
      isPending: launch.isPending,
      searchTerm,
      selectedBranch,
      selectedDocs: launch.selectedDocs,
      selectedFilesCount: selection.selectedFilesCount,
      selectedIds: selection.selectedIds,
      treeData,
    },
  };
}

export type RepoSetupReturn = ReturnType<typeof useRepoSetup>;
export type StateType = RepoSetupReturn["state"];
export type ActionsType = RepoSetupReturn["actions"];
