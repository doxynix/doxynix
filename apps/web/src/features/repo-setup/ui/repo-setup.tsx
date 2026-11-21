"use client";

import type { DocType } from "@doxynix/shared";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";

import { useRepoSetup } from "../model/use-repo-setup";
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
    <div className="flex h-full min-h-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,620px)] xl:grid-cols-[minmax(0,1fr)_minmax(520px,720px)]">
      <div className="h-[60vh] min-w-0 lg:h-auto lg:min-h-0">
        <RepoFileTree
          actions={actions}
          repo={repo}
          state={state}
          treeApi={refs.treeApi}
        />
      </div>
      <RepoAnalysisConfig
        actions={actions}
        className="min-h-0"
        disabled={isBusy}
        state={state}
      />
    </div>
  );
}
