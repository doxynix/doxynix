import React, { useMemo } from "react";
import { Check, Folder, FolderOpen, Search, Sparkles, X } from "lucide-react";
import { Tree, type TreeApi } from "react-arborist";

import { cn } from "@/shared/lib/utils";
import type { FileNode, RepoDetailed } from "@/shared/types/repo";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import type { ActionsType, StateType } from "../model/user-repo-setup";
import { RepoBranchSelector } from "./repo-branch-selector";
import { RepoFileNode } from "./repo-file-node";
import { RepoSetupSkeleton } from "./repo-setup-skeleton";

type Props = {
  repo: RepoDetailed;
  state: StateType;
  actions: ActionsType;
  treeApi: TreeApi<FileNode> | null;
};

export function RepoFileTree({ repo, state, actions, treeApi }: Props) {
  const treeActions = useMemo(
    () => [
      { label: "Expand All", icon: FolderOpen, onClick: () => treeApi?.openAll() },
      { label: "Collapse All", icon: Folder, onClick: () => treeApi?.closeAll() },
    ],
    [treeApi]
  );

  const selectionActions = useMemo(
    () => [
      { label: "Select All", icon: Check, onClick: actions.handleSelectAll },
      {
        label: "Select Recommended",
        icon: Sparkles,
        onClick: actions.handleSelectRecommended,
        tooltip: "Automatically select files for analysis",
      },
      {
        label: "Clear",
        icon: X,
        onClick: actions.handleClearAll,
        className: "text-destructive hover:bg-destructive/10 hover:text-destructive",
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
            selectedBranch={state.selectedBranch}
            defaultBranch={repo.defaultBranch}
            onSelect={actions.setSelectedBranch}
          />
        </div>
        <div className="flex flex-2 flex-col gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              placeholder="Search files..."
              type="search"
              value={state.searchTerm}
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
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={action.onClick}
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
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 gap-1.5 px-2", action.className)}
                  onClick={action.onClick}
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
        className="overflow-hidden rounded-lg border p-1"
        onPointerDownCapture={(e) => e.target === e.currentTarget && e.stopPropagation()}
        onKeyDownCapture={(e) => e.key === " " && e.stopPropagation()}
      >
        {state.isLoading ? (
          <RepoSetupSkeleton />
        ) : (
          <Tree
            ref={(api) => actions.setTreeApi(api || null)}
            data={state.treeData}
            searchTerm={state.searchTerm}
            searchMatch={(node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())}
            openByDefault={false}
            width="100%"
            height={580}
            indent={20}
            rowHeight={34}
            disableDrag
            disableDrop
            disableEdit
            onRename={() => {}}
            onDelete={() => {}}
            onCreate={() => null}
            onMove={() => {}}
            disableMultiSelection={false}
            selectionFollowsFocus={false}
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
