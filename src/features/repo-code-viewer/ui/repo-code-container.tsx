"use client";

import { useQueryState } from "nuqs";

import { trpc, type UiRepoDetailed } from "@/shared/api/trpc";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";

import { RepoCodeBrowser } from "./repo-code-browser";
import { CodeSkeleton } from "./repo-code-skeleton";
import { RepoCodeTree } from "./repo-code-tree";

export function RepoCodeContainer({ repo }: Readonly<{ repo: UiRepoDetailed }>) {
  const [path, setPath] = useQueryState("path");

  const { data, isLoading } = trpc.repoGithub.getFileContent.useQuery(
    { path: path ?? "", repoId: repo.id },
    { enabled: path != null && path !== "" }
  );

  return (
    <div className="bg-background flex h-[calc(100vh-180px)] overflow-hidden rounded-xl border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="50%" maxSize="50%" minSize="25%">
          <RepoCodeTree
            activePath={path}
            repo={repo}
            onSelect={(val) => {
              void setPath(val);
            }}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="50%">
          {isLoading ? (
            <CodeSkeleton />
          ) : path != null && data ? (
            <RepoCodeBrowser fileData={data} path={path} repoId={repo.id} />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center italic">
              Select a file to view its content
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
