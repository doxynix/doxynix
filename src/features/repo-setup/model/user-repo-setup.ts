import { useCallback, useEffect, useMemo, useState } from "react";
import { DocType } from "@prisma/client";
import { useLocale } from "next-intl";
import type { TreeApi } from "react-arborist";

import { trpc } from "@/shared/api/trpc";
import type { FileNode, RepoDetailed } from "@/shared/types/repo";
import type { FileTuple } from "@/shared/types/repo-setup";
import { collectAllIds, getFolderSelectionState, sortNodes } from "@/features/repo-setup";

export type RepoSetupReturn = ReturnType<typeof useRepoSetup>;

export type StateType = RepoSetupReturn["state"];
export type ActionsType = RepoSetupReturn["actions"];

export function useRepoSetup(repo: RepoDetailed) {
  const locale = useLocale();
  const [selectedBranch, setSelectedBranch] = useState(repo.defaultBranch);
  const [searchTerm, setSearchTerm] = useState("");
  const [treeApi, setTreeApi] = useState<TreeApi<FileNode> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analysisLocale, setAnalysisLocale] = useState(locale);
  const [instructions, setInstructions] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<DocType[]>([DocType.README]);

  const { owner, name } = repo;

  const { data: branches } = trpc.repo.getBranches.useQuery({ owner, name });
  const { data: apiFiles, isLoading } = trpc.repo.getRepoFiles.useQuery({
    owner,
    name,
    branch: selectedBranch,
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
            id: currentPath,
            name: part,
            path: currentPath,
            type: isLast ? (type === 1 ? "blob" : "tree") : "tree",
            recommended: isLast ? recommended === 1 : false,
            sha: isLast ? sha : "",
            children: isLast ? undefined : [],
          };
          map.set(currentPath, newNode);
          if (index === 0) root.push(newNode);
          else {
            const parent = map.get(parentPath);
            if (parent && parent.children) parent.children.push(newNode);
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
      repoId: repo.id,
      files: Array.from(selectedIds).filter((id) => leafFilePaths.has(id)),
      branch: selectedBranch,
      language: analysisLocale,
      instructions,
      docTypes: selectedDocs,
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
    state: {
      selectedBranch,
      searchTerm,
      treeData,
      selectedIds,
      analysisLocale,
      instructions,
      selectedDocs,
      selectedFilesCount,
      isLoading,
      branches,
    },
    actions: {
      setSelectedBranch,
      setSearchTerm,
      setTreeApi,
      setAnalysisLocale,
      setInstructions,
      toggleDocType,
      handleToggleSelection,
      handleSelectAll,
      handleClearAll,
      handleSelectRecommended,
      handleStartAnalysis,
    },
    refs: {
      treeApi,
    },
  };
}
