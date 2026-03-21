"use client";

import React from "react";
import { Folder, FolderOpen, Search } from "lucide-react";
import { Tree } from "react-arborist";

import type { UiRepoDetailed } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";

import { RepoBranchSelector, useRepoSetup } from "@/entities/repo-setup";

import { useRepoCodeActions, useRepoCodeStore } from "../model/use-repo-code.store";
import { RepoCodeNode } from "./repo-code-node";
import { RepoCodeTreeSkeleton } from "./repo-code-tree-skeleton";

type Props = {
  activePath: string | null;
  onSelect: (path: string) => void;
  repo: UiRepoDetailed;
};

type ActionItem = {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tooltip?: string;
};

export function RepoCodeTree({ activePath, onSelect, repo }: Readonly<Props>) {
  const { actions, state } = useRepoSetup(repo);
  const { setTreeApi } = useRepoCodeActions();
  const treeApi = useRepoCodeStore((s) => s.treeApi);

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
        <RepoBranchSelector
          branches={state.branches}
          defaultBranch={repo.defaultBranch}
          selectedBranch={state.selectedBranch}
          onSelect={(branch) => {
            void actions.setSelectedBranch(branch);

            onSelect("");
          }}
        />
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2 left-2 size-3.5" />
          <Input
            type="search"
            value={state.searchTerm}
            placeholder="Search..."
            onChange={(e) => {
              void actions.setSearchTerm(e.target.value);
            }}
            className="bg-background h-8 pl-7 text-xs"
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

      <div className="flex-1 overflow-hidden p-2">
        {state.isLoading ? (
          <RepoCodeTreeSkeleton />
        ) : state.treeData.length === 0 ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No files found
          </p>
        ) : (
          <Tree
            ref={(api) => setTreeApi(api ?? undefined)}
            disableDrag
            disableDrop
            disableEdit
            data={state.treeData}
            disableMultiSelection={false}
            height={700}
            indent={16}
            openByDefault={false}
            rowHeight={30}
            searchMatch={(node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())}
            searchTerm={state.searchTerm}
            selectionFollowsFocus={false}
            width="100%"
            onCreate={() => null}
            onDelete={() => {}}
            onMove={() => {}}
            onRename={() => {}}
          >
            {(props) => <RepoCodeNode {...props} activePath={activePath} onSelect={onSelect} />}
          </Tree>
        )}
      </div>
    </div>
  );
}
