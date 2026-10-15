"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import type { TreeApi } from "react-arborist";

import { useTRPC } from "@/shared/api/trpc";
import { usePanelLayout } from "@/shared/lib/hooks/use-panel-layout";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";

import type { UiRepoDetailed } from "@/entities/repo/model/repo.types";
import type { FileNode } from "@/entities/repo/model/repo-setup.types";
import { useNodeContext } from "@/entities/repo/model/use-node-context";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { RepoCodeBrowser } from "./repo-code-browser";
import { CodeSkeleton } from "./repo-code-skeleton";
import { RepoCodeTree } from "./repo-code-tree";

type Props = {
  repo: UiRepoDetailed;
};

export function RepoCodeContainer({ repo }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const [path, setPath] = useQueryState("path", parseAsString);
  const [node, setNode] = useQueryState("node", parseAsString);
  const [treeApi, setTreeApi] = useState<TreeApi<FileNode> | undefined>();
  const { aid } = useRepoParams();

  const { data: nodeContext } = useNodeContext({
    aid: aid ?? undefined,
    nodeId: node,
    repoId: repo.id,
  });

  const { data, isLoading } = useQuery(
    trpc.githubBrowse.getFileContent.queryOptions(
      { path: path ?? "", repoId: repo.id },
      { enabled: path != null && path !== "" },
    ),
  );

  useEffect(() => {
    if (path != null && path.length > 0) {
      return;
    }

    const nextPath = nodeContext?.related.files[0];
    if (nextPath == null || nextPath.length === 0) {
      return;
    }

    void setPath(nextPath);
  }, [nodeContext?.related.files, path, setPath]);

  const { defaultLayout, onLayoutChanged } = usePanelLayout("repo-code");

  return (
    <div className="flex h-[calc(100dvh-260px)] overflow-hidden rounded-xl border bg-background">
      <ResizablePanelGroup
        defaultLayout={defaultLayout}
        id="repo-code"
        onLayoutChanged={onLayoutChanged}
        orientation="horizontal"
      >
        <ResizablePanel
          defaultSize="50%"
          id="repo-code-tree"
          maxSize="50%"
          minSize="25%"
        >
          <RepoCodeTree
            activePath={path}
            onSelect={(val) => {
              void setPath(val);
              void setNode(val != null ? `file:${val}` : null);
            }}
            onTreeApiChange={setTreeApi}
            repo={repo}
            treeApi={treeApi}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel
          defaultSize="50%"
          id="repo-code-browser"
        >
          {isLoading ? (
            <CodeSkeleton />
          ) : path != null && data ? (
            <RepoCodeBrowser
              fileData={data}
              path={path}
              repo={repo}
              repoId={repo.id}
              treeApi={treeApi}
            />
          ) : (
            <p className="flex h-full items-center justify-center text-muted-foreground">
              {t("repo_code_select_file")}
            </p>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
