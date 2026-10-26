"use client";

import type { DocType } from "@doxynix/shared";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import { useRepoSetup } from "@/entities/repo/model/use-repo-setup";

import { RepoAnalysisConfig } from "./repo-analysis-config";
import { RepoFileTree } from "./repo-file-tree";

type Props = {
  initialDocTypes?: DocType[];
  repo: UiRepoDetailed;
  selectRecommendedOnLoad?: boolean;
};

export function RepoSetup({ initialDocTypes, repo, selectRecommendedOnLoad }: Readonly<Props>) {
  const { actions, refs, state } = useRepoSetup(repo, {
    initialDocTypes,
    selectRecommendedOnLoad,
  });

  const isBusy = state.isLoading || state.isPending;

  return (
    <div className="flex h-[calc(100dvh-260px)] w-full justify-center gap-6">
      <div className="flex-1">
        <RepoFileTree
          actions={actions}
          repo={repo}
          state={state}
          treeApi={refs.treeApi}
        />
      </div>
      <RepoAnalysisConfig
        actions={actions}
        disabled={isBusy}
        state={state}
      />
    </div>
  );
}
