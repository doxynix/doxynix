"use client";

import { startTransition, useEffect } from "react";
import { Folder, FolderOpen, Search } from "lucide-react";
import { Tree, type TreeApi } from "react-arborist";

import { useResizeObserver } from "@/shared/hooks/use-resize-observer";
import { AppButton } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import type { ActionItem, FileNode } from "@/entities/repo/model/repo-setup.types";
import { useRepoSetup } from "@/entities/repo/model/use-repo-setup";
import { RepoBranchSelector } from "@/entities/repo/ui/repo-branch-selector";
import { RepoCodeNode } from "@/entities/repo/ui/repo-code-node";
import { RepoTreeSkeleton } from "@/entities/repo/ui/repo-tree-skeleton";

type Props = {
  activePath: null | string;
  onSelect: (path: null | string) => void;
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

  useEffect(() => {
    if (activePath == null || treeApi == null) {
      return;
    }

    try {
      const nodeId = activePath;
      treeApi.openParents(nodeId);
      treeApi.select(nodeId);

      void treeApi.scrollTo(nodeId, "smart");
    } catch (error) {
      console.warn("Failed to sync tree arborist viewport:", error);
    }
  }, [activePath, treeApi]);

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

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex flex-col gap-2 border-border border-b bg-muted p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute top-2.75 left-2.5 size-3.5 text-muted-foreground" />
            <Input
              className="bg-background pl-7 text-xs"
              onChange={(e) => {
                void actions.setSearchTerm(e.target.value);
              }}
              placeholder="Search..."
              type="search"
              value={state.searchTerm}
            />
          </div>
          <RepoBranchSelector
            branches={state.branches}
            defaultBranch={repo.defaultBranch}
            isLoading={state.isBranchesLoading}
            onSelect={(branch) => {
              void actions.setSelectedBranch(branch);
              onSelect(null);
            }}
            selectedBranch={state.selectedBranch}
          />
        </div>
        <div className="flex items-center gap-4">
          {treeActions.map((action) => (
            <AppButton
              className="gap-1.5 px-2"
              key={action.label}
              onClick={action.onClick}
              size="sm"
              variant="ghost"
            >
              <action.icon />
              {action.label}
            </AppButton>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2" ref={measureRef}>
        {state.isLoading ? (
          <RepoTreeSkeleton variant="tree" />
        ) : state.treeData.length === 0 ? (
          <p className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No files found
          </p>
        ) : (
          size.height > 0 && (
            <Tree
              data={state.treeData}
              disableDrag
              disableDrop
              disableEdit
              disableMultiSelection={true}
              height={size.height}
              indent={16}
              onActivate={(node) => {
                if (node.isLeaf) {
                  onSelect(node.data.path);
                }
              }}
              onCreate={() => null}
              onDelete={() => {}}
              onMove={() => {}}
              onRename={() => {}}
              openByDefault={false}
              overscanCount={30}
              ref={(api) => onTreeApiChange(api ?? undefined)}
              rowHeight={32}
              searchMatch={(node, term) =>
                node.data.name.toLowerCase().includes(term.toLowerCase())
              }
              searchTerm={state.searchTerm}
              selectionFollowsFocus={false}
              width="100%"
            >
              {(props) => <RepoCodeNode {...props} activePath={activePath} onSelect={onSelect} />}
            </Tree>
          )
        )}
      </div>
    </div>
  );
}
