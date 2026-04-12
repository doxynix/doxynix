"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import type { TreeApi } from "react-arborist";

import { trpc, type UiRepoDetailed } from "@/shared/api/trpc";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";

import type { FileNode } from "@/entities/repo-setup";

import { RepoCodeBrowser } from "./repo-code-browser";
import { CodeSkeleton } from "./repo-code-skeleton";
import { RepoCodeTree } from "./repo-code-tree";

type Props = {
  repo: UiRepoDetailed;
};

export function RepoCodeContainer({ repo }: Readonly<Props>) {
  const [path, setPath] = useQueryState("path");
  const [treeApi, setTreeApi] = useState<TreeApi<FileNode> | undefined>();

  const { data, isLoading } = trpc.githubBrowse.getFileContent.useQuery(
    { path: path ?? "", repoId: repo.id },
    { enabled: path != null && path !== "" }
  );

  return (
    <div className="bg-background flex h-[calc(100dvh-260px)] overflow-hidden rounded-xl border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="50%" maxSize="50%" minSize="25%">
          <RepoCodeTree
            activePath={path}
            repo={repo}
            treeApi={treeApi}
            onSelect={(val) => {
              void setPath(val);
            }}
            onTreeApiChange={setTreeApi}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="50%">
          {isLoading ? (
            <CodeSkeleton />
          ) : path != null && data ? (
            <RepoCodeBrowser fileData={data} path={path} repoId={repo.id} treeApi={treeApi} />
          ) : (
            <p className="text-muted-foreground flex h-full items-center justify-center">
              Select a file to view its content
            </p>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
