"use client";

import type { RepoDetailed } from "@/shared/types/repo";

import { useRepoSetup } from "../model/user-repo-setup";
import { RepoAnalysisConfig } from "./repo-analysis-config";
import { RepoFileTree } from "./repo-file-tree";

type Props = {
  repo: RepoDetailed;
};

export function RepoSetup({ repo }: Props) {
  const { state, actions, refs } = useRepoSetup(repo);

  const isAnalysisDisabled = state.selectedFilesCount === 0 || state.selectedDocs.length === 0;

  return (
    <div className="flex justify-center gap-4">
      <RepoFileTree repo={repo} state={state} actions={actions} treeApi={refs.treeApi} />

      <RepoAnalysisConfig state={state} actions={actions} disabled={isAnalysisDisabled} />
    </div>
  );
}
