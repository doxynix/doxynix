import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";
import { searchTextParam } from "@/shared/lib/search-params";

import type { UiRepoDetailed } from "./repo.types";
import type { FileTuple } from "./repo-setup.types";
import { buildFileTree, matchesSearch } from "./repo-setup-utils";

export function useRepoTreeData(repo: UiRepoDetailed, branch: string) {
  const trpc = useTRPC();
  const [searchTerm, setSearchTerm] = useQueryState("search", searchTextParam);
  const { name, owner } = repo;

  const { data, isLoading } = useQuery(
    trpc.githubBrowse.getRepoFiles.queryOptions({
      branch,
      name,
      owner,
    }),
  );

  const files = data as FileTuple[] | undefined;
  const treeData = buildFileTree(files);
  const hasSearchMatches = matchesSearch(searchTerm, files);

  return {
    files,
    hasSearchMatches,
    isLoading,
    searchTerm,
    setSearchTerm,
    treeData,
  };
}
