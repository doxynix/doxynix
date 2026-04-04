"use client";

import React from "react";
import { Folder, FolderOpen, Search } from "lucide-react";
import { Tree, type TreeApi } from "react-arborist";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { useResizeObserver } from "@/shared/hooks/use-resize-observer";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";

import {
  RepoBranchSelector,
  RepoTreeSkeleton,
  useRepoSetup,
  type ActionItem,
  type FileNode,
} from "@/entities/repo-setup";

import { RepoCodeNode } from "./repo-code-node";

type Props = {
  activePath: string | null;
  onSelect: (path: string) => void;
  onTreeApiChange: (api: TreeApi<FileNode> | undefined) => void;
  repo: UiRepoDetailed;
  treeApi: TreeApi<FileNode> | undefined;
};

export function RepoCodeTree({
  activePath,
  onSelect,
  onTreeApiChange,
  repo,
  treeApi,
}: Readonly<Props>) {
  const { actions, state } = useRepoSetup(repo);

  const [measureRef, size] = useResizeObserver<HTMLDivElement>();

  const handleExpandAll = () => {
    React.startTransition(() => {
      treeApi?.openAll();
    });
  };
  const handleCollapseAll = () => {
    React.startTransition(() => {
      treeApi?.closeAll();
    });
  };

  const treeActions = [
    { icon: FolderOpen, label: "Expand All", onClick: handleExpandAll },
    { icon: Folder, label: "Collapse All", onClick: handleCollapseAll },
  ] satisfies ActionItem[];

  return (
    <div className="bg-card flex h-full flex-col">
      <div className="border-border/40 bg-muted/20 flex flex-col gap-2 border-b p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.75 left-2.5 size-3.5" />
            <Input
              type="search"
              value={state.searchTerm}
              placeholder="Search..."
              onChange={(e) => {
                void actions.setSearchTerm(e.target.value);
              }}
              className="bg-background pl-7 text-xs"
            />
          </div>
          <RepoBranchSelector
            branches={state.branches}
            defaultBranch={repo.defaultBranch}
            isLoading={state.isBranchesLoading}
            selectedBranch={state.selectedBranch}
            onSelect={(branch) => {
              void actions.setSelectedBranch(branch);

              onSelect("");
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          {treeActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="ghost"
              onClick={action.onClick}
              className="gap-1.5 px-2"
            >
              <action.icon className="size-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <div ref={measureRef} className="min-h-0 flex-1 overflow-hidden p-2">
        {state.isLoading ? (
          <RepoTreeSkeleton variant="tree" />
        ) : state.treeData.length === 0 ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No files found
          </p>
        ) : (
          size.height > 0 && (
            <Tree
              ref={(api) => onTreeApiChange(api ?? undefined)}
              disableDrag
              disableDrop
              disableEdit
              data={state.treeData}
              disableMultiSelection={true}
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
              onActivate={(node) => {
                if (node.isLeaf) {
                  onSelect(node.data.path);
                }
              }}
              onCreate={() => null}
              onDelete={() => {}}
              onMove={() => {}}
              onRename={() => {}}
            >
              {(props) => <RepoCodeNode {...props} activePath={activePath} onSelect={onSelect} />}
            </Tree>
          )
        )}
      </div>
    </div>
  );
}
