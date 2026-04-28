"use client";

import { useEffect, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import type { TreeApi } from "react-arborist";

import { trpc, type UiRepoDetailed } from "@/shared/api/trpc";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";

import type { FileNode } from "@/entities/repo-setup/model/repo-setup.types";

import { RepoCodeBrowser } from "./repo-code-browser";
import { CodeSkeleton } from "./repo-code-skeleton";
import { RepoCodeTree } from "./repo-code-tree";

type Props = {
  repo: UiRepoDetailed;
};

export function RepoCodeContainer({ repo }: Readonly<Props>) {
  const [path, setPath] = useQueryState("path", parseAsString.withOptions({ shallow: true }));
  const [node, setNode] = useQueryState("node", parseAsString.withOptions({ shallow: true }));
  const [treeApi, setTreeApi] = useState<TreeApi<FileNode> | undefined>();

  const { data: nodeContext } = trpc.repoDetails.getNodeContext.useQuery(
    { nodeId: node ?? "", repoId: repo.id },
    { enabled: node != null && node.length > 0 }
  );

  const { data, isLoading } = trpc.githubBrowse.getFileContent.useQuery(
    { path: path ?? "", repoId: repo.id },
    { enabled: path != null && path !== "" }
  );

  useEffect(() => {
    if (path != null && path.length > 0) return;

    const nextPath = nodeContext?.related.files[0];
    if (nextPath == null || nextPath.length === 0) return;

    void setPath(nextPath);
  }, [nodeContext?.related.files, path, setPath]);

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
              void setNode(val != null ? `file:${val}` : null);
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
