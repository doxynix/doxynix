import React, { useMemo } from "react";
import { Check, Folder, FolderOpen, Search, Sparkles, X } from "lucide-react";
import { Tree, type TreeApi } from "react-arborist";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import type { FileNode } from "@/shared/types/repo";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import type { ActionsType, StateType } from "../model/user-repo-setup";
import { RepoBranchSelector } from "./repo-branch-selector";
import { RepoFileNode } from "./repo-file-node";
import { RepoSetupSkeleton } from "./repo-setup-skeleton";

type Props = {
  actions: ActionsType;
  repo: UiRepoDetailed;
  state: StateType;
  treeApi: TreeApi<FileNode> | null;
};

export function RepoFileTree({ actions, repo, state, treeApi }: Readonly<Props>) {
  const treeActions = useMemo(
    () => [
      { icon: FolderOpen, label: "Expand All", onClick: () => treeApi?.openAll() },
      { icon: Folder, label: "Collapse All", onClick: () => treeApi?.closeAll() },
    ],
    [treeApi]
  );

  const selectionActions = useMemo(
    () => [
      { icon: Check, label: "Select All", onClick: actions.handleSelectAll },
      {
        icon: Sparkles,
        label: "Select Recommended",
        onClick: actions.handleSelectRecommended,
        tooltip: "Automatically select files for analysis",
      },
      {
        className: "text-destructive hover:bg-destructive/10 hover:text-destructive",
        icon: X,
        label: "Clear",
        onClick: actions.handleClearAll,
      },
    ],
    [actions]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-sm font-medium">Select Branch</span>
          <RepoBranchSelector
            branches={state.branches}
            defaultBranch={repo.defaultBranch}
            selectedBranch={state.selectedBranch}
            onSelect={actions.setSelectedBranch}
          />
        </div>
        <div className="flex flex-2 flex-col gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              type="search"
              value={state.searchTerm}
              placeholder="Search files..."
              onChange={(e) => actions.setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col items-end justify-between gap-2 px-1 text-xs">
        <div className="flex gap-4">
          <div className="flex">
            {treeActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="ghost"
                onClick={action.onClick}
                className="h-7 gap-1.5 px-2"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>

          <div className="flex">
            {selectionActions.map((action) => {
              const ButtonElement = (
                <Button
                  key={action.label}
                  size="sm"
                  variant="ghost"
                  onClick={action.onClick}
                  className={cn("h-7 gap-1.5 px-2", action.className)}
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              );
              return action.tooltip != null && action.tooltip !== "" ? (
                <AppTooltip key={action.label} content={action.tooltip}>
                  {ButtonElement}
                </AppTooltip>
              ) : (
                ButtonElement
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 font-medium">
          <span>Files selected: {state.selectedFilesCount}</span>
        </div>
      </div>

      <div
        onKeyDownCapture={(e) => e.key === " " && e.stopPropagation()}
        onPointerDownCapture={(e) => e.target === e.currentTarget && e.stopPropagation()}
        className="overflow-hidden rounded-lg border p-1"
      >
        {state.isLoading ? (
          <RepoSetupSkeleton />
        ) : (
          <Tree
            ref={(api) => actions.setTreeApi(api || null)}
            disableDrag
            disableDrop
            disableEdit
            data={state.treeData}
            disableMultiSelection={false}
            height={580}
            indent={20}
            openByDefault={false}
            rowHeight={34}
            searchMatch={(node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())}
            searchTerm={state.searchTerm}
            selectionFollowsFocus={false}
            width="100%"
            onCreate={() => null}
            onDelete={() => {}}
            onMove={() => {}}
            onRename={() => {}}
          >
            {(props) => (
              <RepoFileNode
                {...props}
                mySelectedIds={state.selectedIds}
                onMyToggle={actions.handleToggleSelection}
              />
            )}
          </Tree>
        )}
      </div>
    </div>
  );
}
