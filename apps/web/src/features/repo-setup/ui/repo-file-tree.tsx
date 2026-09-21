import { startTransition } from "react";
import { Check, Folder, FolderOpen, Search, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tree, type TreeApi } from "react-arborist";

import { cn } from "@/shared/lib/cn";
import { useResizeObserver } from "@/shared/lib/hooks/use-resize-observer";
import { AppButton } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import type { ActionItem, FileNode } from "@/entities/repo/model/repo-setup.types";
import type { ActionsType, StateType } from "@/entities/repo/model/use-repo-setup";
import { RepoBranchSelector } from "@/entities/repo/ui/repo-branch-selector";
import { RepoTreeSkeleton } from "@/entities/repo/ui/repo-tree-skeleton";

import { RepoFileNode } from "./repo-file-node";

type Props = {
  actions: ActionsType;
  repo: UiRepoDetailed;
  state: StateType;
  treeApi: null | TreeApi<FileNode>;
};

export function RepoFileTree({ actions, repo, state, treeApi }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const [measureRef, size] = useResizeObserver<HTMLDivElement>();

  const handleExpandAll = () => {
    startTransition(() => {
      treeApi?.openAll();
    });
  };
  const handleCollapseAll = () => {
    startTransition(() => {
      treeApi?.closeAll();
    });
  };

  const treeActions = [
    { icon: FolderOpen, label: t("repo_file_tree_expand_all"), onClick: handleExpandAll },
    { icon: Folder, label: t("repo_file_tree_collapse_all"), onClick: handleCollapseAll },
  ] satisfies ActionItem[];

  const selectionActions = [
    { icon: Check, label: t("repo_file_tree_select_all"), onClick: actions.handleSelectAll },
    {
      icon: Sparkles,
      label: t("repo_file_tree_select_recommended"),
      onClick: actions.handleSelectRecommended,
      tooltip: t("repo_file_tree_select_recommended_tooltip"),
    },
    {
      className: "text-destructive hover:bg-destructive/10 hover:text-destructive",
      icon: X,
      label: t("repo_file_tree_clear"),
      onClick: actions.handleClearAll,
    },
  ] satisfies ActionItem[];

  const isSearchEmpty = state.searchTerm !== "" && state.hasSearchMatches === false;

  const isRepoEmpty = !state.isLoading && state.treeData.length === 0 && state.searchTerm === "";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => {
                void actions.setSearchTerm(e.target.value);
              }}
              placeholder={t("repo_file_tree_search_placeholder")}
              type="search"
              value={state.searchTerm}
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <span className="font-medium text-sm">{t("repo_file_tree_select_branch")}</span>
          <RepoBranchSelector
            branches={state.branches}
            defaultBranch={repo.defaultBranch}
            isLoading={state.isBranchesLoading}
            onSelect={(val) => {
              void actions.setSelectedBranch(val);
            }}
            selectedBranch={state.selectedBranch}
          />
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-2 px-1 text-muted-foreground text-xs">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center">
            {treeActions.map((action) => (
              <AppButton
                className="h-7 gap-1.5 px-2"
                key={action.label}
                onClick={action.onClick}
                size="sm"
                variant="ghost"
              >
                <action.icon />
                {action.label}
              </AppButton>
            ))}

            {selectionActions.map((action) => {
              const ButtonElement = (
                <AppButton
                  className={cn("h-7 gap-1.5 px-2", action.className)}
                  key={action.label}
                  onClick={action.onClick}
                  size="sm"
                  variant="ghost"
                >
                  <action.icon />
                  {action.label}
                </AppButton>
              );
              return action.tooltip != null && action.tooltip !== "" ? (
                <AppTooltip
                  content={action.tooltip}
                  key={action.label}
                >
                  {ButtonElement}
                </AppTooltip>
              ) : (
                ButtonElement
              );
            })}
          </div>
          <span>{t("repo_file_tree_selected_count", { count: state.selectedFilesCount })}</span>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border p-1"
        onPointerDownCapture={(e) => e.target === e.currentTarget && e.stopPropagation()}
      >
        {isSearchEmpty && (
          <p className="absolute inset-0 z-10 flex items-center justify-center truncate text-muted-foreground text-sm">
            {t("repo_file_tree_nothing_found", { term: state.searchTerm })}
          </p>
        )}

        {isRepoEmpty && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground text-sm">
            {t("repo_file_tree_empty_repo")}
          </p>
        )}
        <div
          className="relative h-full min-h-0 w-full flex-1 overflow-hidden"
          ref={measureRef}
        >
          {state.isLoading ? (
            <RepoTreeSkeleton variant="setup" />
          ) : (
            size.height > 0 && (
              <Tree
                data={state.treeData}
                disableDrag
                disableDrop
                disableEdit
                disableMultiSelection={false}
                height={size.height}
                indent={16}
                onActivate={(node) => actions.handleToggleSelection(node.id, node.data)}
                onCreate={() => null}
                onDelete={() => {}}
                onMove={() => {}}
                onRename={() => {}}
                openByDefault={false}
                overscanCount={30}
                ref={(api) => actions.setTreeApi(api ?? null)}
                rowHeight={32}
                searchMatch={(node, term) =>
                  node.data.name.toLowerCase().includes(term.toLowerCase())
                }
                searchTerm={state.searchTerm}
                selectionFollowsFocus={false}
                width="100%"
              >
                {(props) => (
                  <RepoFileNode
                    {...props}
                    mySelectedIds={state.selectedIds}
                    onMyToggle={actions.handleToggleSelection}
                  />
                )}
              </Tree>
            )
          )}
        </div>
      </div>
    </div>
  );
}
