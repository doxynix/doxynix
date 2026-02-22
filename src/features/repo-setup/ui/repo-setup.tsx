"use client";

import type { RepoDetailed } from "@/shared/types/repo";

import { useRepoSetup } from "../model/user-repo-setup";
import { RepoAnalysisConfig } from "./repo-analysis-config";
import { RepoFileTree } from "./repo-file-tree";

type Props = {
  repo: RepoDetailed;
};

export function RepoSetup({ repo }: Readonly<Props>) {
  const { actions, refs, state } = useRepoSetup(repo);

  const isAnalysisDisabled = state.selectedFilesCount === 0 || state.selectedDocs.length === 0;

  return (
    <div className="flex justify-center gap-4">
      <RepoFileTree actions={actions} repo={repo} state={state} treeApi={refs.treeApi} />

      <RepoAnalysisConfig actions={actions} disabled={isAnalysisDisabled} state={state} />
    </div>
  );
}
