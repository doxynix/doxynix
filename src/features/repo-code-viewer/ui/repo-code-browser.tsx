"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EditorView } from "@uiw/react-codemirror";
import { saveAs } from "file-saver";
import { Code, Download, Edit3, FileCode, Save, Sparkles, X } from "lucide-react";
import type { TreeApi } from "react-arborist";
import { toast } from "sonner";

import { trpc, type FileContent } from "@/shared/api/trpc";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { RepoStatusBar, type EditorStats } from "@/entities/repo-details";
import type { FileNode } from "@/entities/repo-setup";

import { RepoCodeActionButton } from "./repo-code-action-button";
import { RepoSearchPanel } from "./repo-code-search-panel";
import { CodeSkeleton } from "./repo-code-skeleton";

const Editor = dynamic(() => import("./repo-code-editor").then((m) => m.RepoCodeEditor), {
  loading: () => <CodeSkeleton />,
  ssr: false,
});

type Props = {
  fileData: FileContent;
  path: string;
  repoId: string;
  treeApi: TreeApi<FileNode> | undefined;
};

export function RepoCodeBrowser({ fileData, path, repoId, treeApi }: Readonly<Props>) {
  const [mode, setMode] = useState<"edit" | "view">("view");
  const [view, setView] = useState<EditorView | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localContent, setLocalContent] = useState(fileData.content);
  const [prevPath, setPrevPath] = useState(path);
  const [prevExternalContent, setPrevExternalContent] = useState(fileData.content);

  const [editorStats, setEditorStats] = useState<EditorStats>({
    col: 1,
    currentMatch: 0,
    errors: 0,
    isDirty: false,
    line: 1,
    totalLines: 1,
    totalMatches: 0,
  });

  if (path !== prevPath || fileData.content !== prevExternalContent) {
    setPrevPath(path);
    setPrevExternalContent(fileData.content);
    setLocalContent(fileData.content);
    setMode("view");
  }

  const analyzeMutation = trpc.repoAnalysis.analyzeFile.useMutation({
    onSuccess: (data) => toast.success(`Audit started! Job: ${data.jobId}`),
  });

  const documentMutation = trpc.repoAnalysis.documentFile.useMutation({
    onSuccess: (data) => toast.success(`Documentation task queued: ${data.jobId}`),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyF") {
        const isFocusInside = containerRef.current?.contains(document.activeElement);

        if (isFocusInside === true) {
          e.preventDefault();
          e.stopPropagation();
          setIsSearchOpen(true);
        }
      }

      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        view?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, view]);

  const pathParts = path.split("/");

  const handleFolderClick = (index: number) => {
    const targetPath = pathParts.slice(0, index + 1).join("/");
    const isFile = index === pathParts.length - 1;

    if (!isFile && treeApi) {
      treeApi.openParents(targetPath);
      treeApi.open(targetPath);

      void treeApi.scrollTo(targetPath, "smart");
    }
  };

  const handleDownload = () => {
    const fileName = path.split("/").pop() ?? "file.txt";

    saveAs(new Blob([localContent], { type: "text/plain;charset=utf-8" }), fileName);
  };

  const VIEW_ACTIONS = [
    {
      icon: Download,
      onClick: handleDownload,
      tooltipText: "Download file",
    },
    {
      disabled: analyzeMutation.isPending,
      icon: Sparkles,
      onClick: () => analyzeMutation.mutate({ content: localContent, path, repoId }),
      tooltipText: "Quick AI Audit",
    },
    {
      icon: Edit3,
      onClick: () => setMode("edit"),
      tooltipText: "Edit file",
    },
    {
      disabled: documentMutation.isPending,
      icon: Code,
      onClick: () => documentMutation.mutate({ content: localContent, path, repoId }),
      tooltipText: "Document file",
    },
    {
      hidden: fileData.meta.url == null,
      href: fileData.meta.url ?? undefined,
      icon: GitHubIcon,
      tooltipText: "Open file on Github",
    },
  ];

  const EDIT_ACTIONS = [
    {
      hideTooltip: true,
      icon: X,
      label: "Cancel",
      onClick: () => {
        setLocalContent(fileData.content);
        setMode("view");
      },
      tooltipText: "Discard changes",
    },
    {
      hideTooltip: true,
      icon: Save,
      label: "Save Changes",
      onClick: () => {
        setMode("view");
      },
      tooltipText: "Save to repository",
      variant: "outline" as const,
    },
  ];

  const breadcrumbItems = pathParts.map((part, i) => ({
    className: i === pathParts.length - 1 ? "max-w-50" : "max-w-30",
    label: encodeURIComponent(part),
    onClick: () => handleFolderClick(i),
  }));

  return (
    <div ref={containerRef} className="bg-background flex h-full flex-col">
      <div className="border-border flex flex-col justify-between gap-4 border-b px-4 py-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileCode className="text-muted-foreground size-4 shrink-0" />
          <AppBreadcrumbs
            items={breadcrumbItems}
            listClassName="sm:gap-1"
            className="min-w-0 overflow-hidden text-[10px]"
          />
          <CopyButton value={path} tooltipText="Copy file path" className="shrink-0 opacity-100" />
        </div>

        <div className="flex items-center justify-end gap-2">
          {mode === "view" ? (
            <>
              {VIEW_ACTIONS.map(({ icon: Icon, ...action }) => (
                <RepoCodeActionButton key={action.tooltipText} className="size-8" {...action}>
                  <Icon className="size-3" />
                </RepoCodeActionButton>
              ))}
              <CopyButton
                value={localContent}
                tooltipText="Copy file"
                className="size-8 px-3 opacity-100"
              />
            </>
          ) : (
            <>
              {EDIT_ACTIONS.map(({ icon: Icon, label, ...action }) => (
                <RepoCodeActionButton key={label} {...action}>
                  <Icon className="size-3" />
                  {label}
                </RepoCodeActionButton>
              ))}
            </>
          )}
        </div>
      </div>

      {isSearchOpen && view && (
        <RepoSearchPanel stats={editorStats} view={view} onClose={() => setIsSearchOpen(false)} />
      )}

      <div className="relative flex-1 overflow-hidden">
        <Editor
          value={localContent}
          initialValue={fileData.content}
          meta={fileData.meta}
          path={path}
          readOnly={mode === "view"}
          onChange={setLocalContent}
          onStats={setEditorStats}
          onViewCreated={setView}
        />
      </div>

      <RepoStatusBar meta={fileData.meta} readOnly={mode === "view"} stats={editorStats} />
    </div>
  );
}
