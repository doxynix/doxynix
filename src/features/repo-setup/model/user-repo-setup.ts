import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import type { TreeApi } from "react-arborist";

import { trpc, type DocType, type UiRepoDetailed } from "@/shared/api/trpc";
import type { FileNode } from "@/shared/types/repo";
import type { FileTuple } from "@/shared/types/repo-setup";

import { collectAllIds, getFolderSelectionState, sortNodes } from "@/features/repo-setup";

import { DocTypeSchema } from "@/generated/zod";

export type RepoSetupReturn = ReturnType<typeof useRepoSetup>;

export type StateType = RepoSetupReturn["state"];
export type ActionsType = RepoSetupReturn["actions"];

export function useRepoSetup(repo: UiRepoDetailed) {
  const locale = useLocale();
  const [selectedBranch, setSelectedBranch] = useState(repo.defaultBranch);
  const [searchTerm, setSearchTerm] = useState("");
  const [treeApi, setTreeApi] = useState<TreeApi<FileNode> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analysisLocale, setAnalysisLocale] = useState(locale);
  const [instructions, setInstructions] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<DocType[]>([DocTypeSchema.enum.README]);

  const { name, owner } = repo;

  const { data: branches } = trpc.repo.getBranches.useQuery({ name, owner });
  const { data: apiFiles, isLoading } = trpc.repo.getRepoFiles.useQuery({
    branch: selectedBranch,
    name,
    owner,
  });

  const analyzeMutation = trpc.repo.analyze.useMutation();

  useEffect(() => {
    if (apiFiles) {
      const recommendedPaths = (apiFiles as FileTuple[])
        .filter((f) => f[3] === 1 && f[1] === 1)
        .map((f) => f[0]);
      setSelectedIds(new Set(recommendedPaths));
    }
  }, [apiFiles]);

  const treeData = useMemo(() => {
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
  }, [apiFiles]);

  const handleToggleSelection = useCallback((nodeId: string, nodeData: FileNode) => {
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
  }, []);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.children) collect(node.children);
      });
    };
    collect(treeData);
    return ids;
  }, [treeData]);

  const handleSelectAll = useCallback(() => setSelectedIds(new Set(allIds)), [allIds]);
  const handleClearAll = useCallback(() => setSelectedIds(new Set()), []);

  const handleSelectRecommended = useCallback(() => {
    if (!apiFiles) return;
    const recommendedPaths = (apiFiles as FileTuple[])
      .filter((f) => f[3] === 1 && f[1] === 1)
      .map((f) => f[0]);
    setSelectedIds(new Set(recommendedPaths));
  }, [apiFiles]);

  const handleStartAnalysis = () => {
    if (!apiFiles) return;
    const leafFilePaths = new Set(
      (apiFiles as FileTuple[]).filter((f) => f[1] === 1).map((f) => f[0])
    );
    analyzeMutation.mutate({
      branch: selectedBranch,
      docTypes: selectedDocs,
      files: Array.from(selectedIds).filter((id) => leafFilePaths.has(id)),
      instructions,
      language: analysisLocale,
      repoId: repo.id,
    });
  };

  const selectedFilesCount = useMemo(() => {
    if (!apiFiles) return 0;
    const allFilePaths = new Set(
      (apiFiles as FileTuple[]).filter((f) => f[1] === 1).map((f) => f[0])
    );
    let count = 0;
    selectedIds.forEach((id) => {
      if (allFilePaths.has(id)) count++;
    });
    return count;
  }, [selectedIds, apiFiles]);

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
      instructions,
      isLoading,
      searchTerm,
      selectedBranch,
      selectedDocs,
      selectedFilesCount,
      selectedIds,
      treeData,
    },
  };
}
