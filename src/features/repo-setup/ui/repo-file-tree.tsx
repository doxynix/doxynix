import { startTransition } from "react";
import { Check, Folder, FolderOpen, Search, Sparkles, X } from "lucide-react";
import { Tree, type TreeApi } from "react-arborist";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { useResizeObserver } from "@/shared/hooks/use-resize-observer";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";

import {
  RepoBranchSelector,
  RepoTreeSkeleton,
  type ActionItem,
  type ActionsType,
  type FileNode,
  type StateType,
} from "@/entities/repo-setup";

import { RepoFileNode } from "./repo-file-node";

type Props = {
  actions: ActionsType;
  repo: UiRepoDetailed;
  state: StateType;
  treeApi: null | TreeApi<FileNode>;
};

export function RepoFileTree({ actions, repo, state, treeApi }: Readonly<Props>) {
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
    { icon: FolderOpen, label: "Expand All", onClick: handleExpandAll },
    { icon: Folder, label: "Collapse All", onClick: handleCollapseAll },
  ] satisfies ActionItem[];

  const selectionActions = [
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
  ] satisfies ActionItem[];

  const isSearchEmpty = state.searchTerm !== "" && state.hasSearchMatches === false;

  const isRepoEmpty = !state.isLoading && state.treeData.length === 0 && state.searchTerm === "";

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              type="search"
              value={state.searchTerm}
              placeholder="Search files..."
              onChange={(e) => {
                void actions.setSearchTerm(e.target.value);
              }}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-sm font-medium">Select Branch</span>
          <RepoBranchSelector
            branches={state.branches}
            defaultBranch={repo.defaultBranch}
            isLoading={state.isBranchesLoading}
            selectedBranch={state.selectedBranch}
            onSelect={(val) => {
              void actions.setSelectedBranch(val);
            }}
          />
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col items-end justify-between gap-2 px-1 text-xs">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center">
            {treeActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="ghost"
                onClick={action.onClick}
                className="h-7 gap-1.5 px-2"
              >
                <action.icon className="size-4" />
                {action.label}
              </Button>
            ))}

            {selectionActions.map((action) => {
              const ButtonElement = (
                <Button
                  key={action.label}
                  size="sm"
                  variant="ghost"
                  onClick={action.onClick}
                  className={cn("h-7 gap-1.5 px-2", action.className)}
                >
                  <action.icon className="size-4" />
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
          <span>Files selected: {state.selectedFilesCount}</span>
        </div>
      </div>

      <div
        onPointerDownCapture={(e) => e.target === e.currentTarget && e.stopPropagation()}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border p-1"
      >
        {isSearchEmpty && (
          <p className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center truncate text-sm">
            Nothing found for &quot;<span className="max-w-60 truncate">{state.searchTerm}</span>
            &quot;
          </p>
        )}

        {isRepoEmpty && (
          <p className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center text-sm">
            Repository is empty
          </p>
        )}
        <div ref={measureRef} className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
          {state.isLoading ? (
            <RepoTreeSkeleton variant="setup" />
          ) : (
            size.height > 0 && (
              <Tree
                ref={(api) => actions.setTreeApi(api || null)}
                disableDrag
                disableDrop
                disableEdit
                data={state.treeData}
                disableMultiSelection={false}
                height={size.height}
                indent={16}
                openByDefault={false}
                overscanCount={30}
                rowHeight={32}
                searchMatch={(node, term) =>
                  node.data.name.toLowerCase().includes(term.toLowerCase())
                }
                searchTerm={state.searchTerm}
                selectionFollowsFocus={false}
                width="100%"
                onActivate={(node) => actions.handleToggleSelection(node.id, node.data)}
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
            )
          )}
        </div>
      </div>
    </div>
  );
}
