import { useState } from "react";
import { useLocale } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import type { TreeApi } from "react-arborist";

import { trpc, type DocType, type UiRepoDetailed } from "@/shared/api/trpc";

import { DocTypeSchema } from "@/generated/zod";

import type { FileNode, FileTuple } from "./repo-setup.types";
import { useRepoBranchOpen } from "./use-repo-branch.store";
import { collectAllIds, getFolderSelectionState, sortNodes } from "./utils";

export type RepoSetupReturn = ReturnType<typeof useRepoSetup>;

export type StateType = RepoSetupReturn["state"];
export type ActionsType = RepoSetupReturn["actions"];

export function useRepoSetup(repo: UiRepoDetailed) {
  const locale = useLocale();

  const [selectedBranch, setSelectedBranch] = useQueryState("branch", {
    defaultValue: repo.defaultBranch,
  });

  const [searchTerm, setSearchTerm] = useQueryState("search", {
    defaultValue: "",
  });

  const [treeApi, setTreeApi] = useState<null | TreeApi<FileNode>>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analysisLocale, setAnalysisLocale] = useState(locale);
  const [instructions, setInstructions] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<DocType[]>([DocTypeSchema.enum.README]);
  const open = useRepoBranchOpen();

  const { name, owner } = repo;

  const { data: branches, isLoading: isBranchesLoading } = trpc.githubBrowse.getBranches.useQuery(
    { name, owner },
    { enabled: open }
  );
  const { data: apiFiles, isLoading } = trpc.githubBrowse.getRepoFiles.useQuery({
    branch: selectedBranch,
    name,
    owner,
  });

  const analyzeMutation = trpc.repoAnalysis.analyze.useMutation();
  const [prevApiFiles, setPrevApiFiles] = useState(apiFiles);

  if (apiFiles !== prevApiFiles) {
    setPrevApiFiles(apiFiles);

    if (apiFiles != null) {
      const recommendedPaths = (apiFiles as FileTuple[])
        .filter((f) => f[3] === 1 && f[1] === 1)
        .map((f) => f[0]);
      setSelectedIds(new Set(recommendedPaths));
    }
  }

  const getTreeData = () => {
    if (!apiFiles) return [];
    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    apiFiles.forEach((fileArr) => {
      const [path, type, sha, recommended] = fileArr as FileTuple;
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
          if (index === 0) root.push(newNode);
          else {
            const parent = map.get(parentPath);
            if (parent?.children) parent.children.push(newNode);
          }
        }
      });
    });
    return sortNodes(root);
  };

  const treeData = getTreeData();

  const handleToggleSelection = (nodeId: string, nodeData: FileNode) => {
    const idsToToggle = collectAllIds(nodeData);

    setSelectedIds((prev) => {
      const newSelection = new Set(prev);
      const currentState = getFolderSelectionState(nodeData, prev);
      const isCurrentlySelected = currentState === true || currentState === "indeterminate";

      if (isCurrentlySelected) {
        idsToToggle.forEach((id) => newSelection.delete(id));
      } else {
        idsToToggle.forEach((id) => newSelection.add(id));
      }
      return newSelection;
    });
  };

  const getAllIds = () => {
    const ids: string[] = [];
    const collect = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.children) collect(node.children);
      });
    };
    collect(treeData);
    return ids;
  };

  const allIds = getAllIds();

  const handleSelectAll = () => setSelectedIds(new Set(allIds));
  const handleClearAll = () => setSelectedIds(new Set());

  const handleSelectRecommended = () => {
    if (!apiFiles) return;
    const recommendedPaths = (apiFiles as FileTuple[])
      .filter((f) => f[3] === 1 && f[1] === 1)
      .map((f) => f[0]);
    setSelectedIds(new Set(recommendedPaths));
  };

  const handleStartAnalysis = () => {
    if (!apiFiles) return;
    const leafFilePaths = new Set(
      (apiFiles as FileTuple[]).filter((f) => f[1] === 1).map((f) => f[0])
    );
    const selectedFiles = Array.from(selectedIds).filter((id) => leafFilePaths.has(id));
    analyzeMutation.mutate({
      branch: selectedBranch,
      docTypes: selectedDocs,
      files: selectedFiles,
      instructions,
      language: analysisLocale,
      repoId: repo.id,
    });
    posthog.capture("repo_analysis_started", {
      branch: selectedBranch,
      doc_types: selectedDocs,
      has_custom_instructions: instructions.length > 0,
      language: analysisLocale,
      repo_id: repo.id,
      repo_name: repo.name,
      repo_owner: repo.owner,
      selected_files_count: selectedFiles.length,
    });
  };

  const getSelectedFilesCount = () => {
    if (!apiFiles) return 0;
    const allFilePaths = new Set(
      (apiFiles as FileTuple[]).filter((f) => f[1] === 1).map((f) => f[0])
    );
    let count = 0;
    selectedIds.forEach((id) => {
      if (allFilePaths.has(id)) count++;
    });
    return count;
  };

  const selectedFilesCount = getSelectedFilesCount();

  const getHasSearchMatches = () => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (apiFiles as FileTuple[] | undefined)?.some((f) => f[0].toLowerCase().includes(term));
  };

  const hasSearchMatches = getHasSearchMatches();

  const toggleDocType = (id: DocType) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return {
    actions: {
      handleClearAll,
      handleSelectAll,
      handleSelectRecommended,
      handleStartAnalysis,
      handleToggleSelection,
      setAnalysisLocale,
      setInstructions,
      setSearchTerm,
      setSelectedBranch,
      setTreeApi,
      toggleDocType,
    },
    refs: {
      treeApi,
    },
    state: {
      analysisLocale,
      branches,
      hasSearchMatches,
      instructions,
      isBranchesLoading,
      isLoading,
      isPending: analyzeMutation.isPending,
      searchTerm,
      selectedBranch,
      selectedDocs,
      selectedFilesCount,
      selectedIds,
      treeData,
    },
  };
}
