"use client";

import type { UiRepoDetailed } from "@/shared/api/trpc";

import { useRepoSetup } from "@/entities/repo-setup";

import { RepoAnalysisConfig } from "./repo-analysis-config";
import { RepoFileTree } from "./repo-file-tree";

type Props = {
  repo: UiRepoDetailed;
};

export function RepoSetup({ repo }: Readonly<Props>) {
  const { actions, refs, state } = useRepoSetup(repo);

  const isBusy = state.isLoading || state.isPending;

  return (
    <div className="flex justify-center gap-4">
      <RepoFileTree actions={actions} repo={repo} state={state} treeApi={refs.treeApi} />

      <RepoAnalysisConfig actions={actions} disabled={isBusy} state={state} />
    </div>
  );
}
