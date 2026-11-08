import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { useTRPC } from "@/shared/api/trpc";

import type { UiRepoDetailed } from "./repo.types";
import { useRepoBranchOpen } from "./use-repo-branch.store";

export function useRepoBranch(repo: UiRepoDetailed) {
  const [branch, setBranch] = useQueryState("branch", {
    defaultValue: repo.defaultBranch,
  });

  return { branch, setBranch };
}

export function useRepoBranches(repo: UiRepoDetailed) {
  const trpc = useTRPC();
  const open = useRepoBranchOpen();
  const { name, owner } = repo;

  const { data, isLoading } = useQuery(
    trpc.githubBrowse.getBranches.queryOptions({ name, owner }, { enabled: open }),
  );

  return { branches: data, isBranchesLoading: isLoading };
}
