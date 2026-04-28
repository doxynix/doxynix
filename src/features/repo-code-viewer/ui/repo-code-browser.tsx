"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { EditorView } from "@uiw/react-codemirror";
import { saveAs } from "file-saver";
import {
  Check,
  Download,
  Edit3,
  FileChartLine,
  FileIcon,
  FileText,
  Loader2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import type { TreeApi } from "react-arborist";
import { toast } from "sonner";

import { trpc, type FileContent } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/core/button";
import { Spinner } from "@/shared/ui/core/spinner";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppBreadcrumbs } from "@/shared/ui/kit/app-breadcrumbs";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { EditorStats } from "@/entities/repo-details/model/editor-stats.types";
import { RepoStatusBar } from "@/entities/repo-details/ui/repo-status-bar";
import type { FileNode } from "@/entities/repo-setup/model/repo-setup.types";

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
  const { data: session } = useSession();
  const userId = session?.user.id;
  const [mode, setMode] = useState<"edit" | "view">("view");
  const [view, setView] = useState<EditorView | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [isAuditDismissed, setIsAuditDismissed] = useState(false);

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

  const { data: auditResult } = trpc.repoAnalysis.getFileActionResult.useQuery(
    { action: "quick-file-audit", path },
    { enabled: !!path && userId != null }
  );

  const { data: documentResult } = trpc.repoAnalysis.getFileActionResult.useQuery(
    { action: "document-file-preview", path },
    { enabled: !!path && userId != null }
  );

  if (path !== prevPath || fileData.content !== prevExternalContent) {
    setPrevPath(path);
    setPrevExternalContent(fileData.content);
    setLocalContent(fileData.content);
    setMode("view");
    setIsAuditDismissed(false);
    setShowDiff(false);
  }

  const auditMutation = trpc.repoAnalysis.quickFileAudit.useMutation({
    onError: () => setIsAiLoading(false),
    onMutate: () => setIsAiLoading(true),
    onSuccess: () => toast.info("Audit started..."),
  });

  const documentMutation = trpc.repoAnalysis.documentFile.useMutation({
    onError: () => setIsAiLoading(false),
    onMutate: () => setIsAiLoading(true),
    onSuccess: () => toast.info("Documentation generation started..."),
  });

  const stageMutation = trpc.prStaging.stageFile.useMutation({
    onError: (error) => {
      toast.error(`Failed to stage changes: ${error.message}`);
    },
    onSuccess: (data) => {
      toast.success(`Changes staged for PR. Total files in draft: ${data.stagedCount}`);
    },
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

  const handleAudit = () => {
    auditMutation.mutate({ content: localContent, path, repoId });
  };

  const handleDocument = () => {
    documentMutation.mutate({ content: localContent, path, repoId });
  };

  const handleAcceptDiff = (): void => {
    if (documentResult != null) {
      const proposedContent: string = documentResult.content;

      stageMutation.mutate({
        content: proposedContent,
        filePath: path,
        repoId: repoId,
      });

      setLocalContent(proposedContent);

      setShowDiff(false);
    }
  };

  const handleDiscardDiff = () => {
    setShowDiff(false);
  };

  const pinMutation = trpc.repoAnalysis.pinAuditToDocs.useMutation({
    onError: (err) => toast.error("Failed to save: " + err.message),
    onSuccess: () => {
      toast.success("Audit saved to project documentation");
    },
  });

  const VIEW_ACTIONS = [
    {
      icon: Download,
      onClick: handleDownload,
      tooltipText: "Download file",
    },
    {
      disabled: isAiLoading || auditMutation.isPending,
      icon: Sparkles,
      onClick: handleAudit,
      tooltipText: "Quick AI Audit",
    },
    {
      icon: Edit3,
      onClick: () => setMode("edit"),
      tooltipText: "Edit file",
    },
    {
      disabled: isAiLoading || documentMutation.isPending,
      icon: FileText,
      onClick: handleDocument,
      tooltipText: "Document file",
    },
    {
      icon: FileChartLine,
      onClick: () => setIsAuditDismissed(false),
      tooltipText: "Sho documentation",
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
          <FileIcon className="text-muted-foreground" />
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

      {auditResult?.action === "quick-file-audit" && !isAuditDismissed && (
        <div className="bg-popover animate-in fade-in slide-in-from-right-4 absolute top-20 right-6 z-50 w-96 rounded-xl border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold">Audit Result</h3>
            <Button size="icon" variant="ghost" onClick={() => setIsAuditDismissed(true)}>
              <X />
            </Button>
          </div>
          <article
            dangerouslySetInnerHTML={{ __html: auditResult.html }}
            className="prose prose-invert text-foreground max-h-120 overflow-y-auto text-xs"
          />
          <div className="mt-4 flex items-center gap-1 border-t pt-3">
            <Button
              disabled={pinMutation.isPending}
              size="sm"
              variant="outline"
              onClick={() => pinMutation.mutate({ path, repoId })}
              className="w-full"
            >
              {pinMutation.isPending ? <Spinner className="size-3" /> : <Save className="size-3" />}
              Pin to Docs
            </Button>
          </div>
        </div>
      )}

      {showDiff === false && documentResult?.action === "document-file-preview" && (
        <div className="bg-primary/5 border-primary/20 animate-in slide-in-from-top-1 flex items-center justify-between border-b px-4 py-2 duration-300">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full">
              <Sparkles className="text-primary h-3 w-3" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-tight">
                Documentation Preview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleDiscardDiff}>
              <X className="mr-1 h-3 w-3" />
              Discard
            </Button>
            <Button
              disabled={stageMutation.isPending === true}
              size="sm"
              variant="default"
              onClick={handleAcceptDiff}
            >
              {stageMutation.isPending === true ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Accept Changes
            </Button>
          </div>
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <Editor
          value={
            !showDiff && documentResult?.content != null ? documentResult.content : localContent
          }
          compareValue={fileData.content}
          initialValue={fileData.content}
          meta={fileData.meta}
          path={path}
          readOnly={mode === "view"}
          showDiff={!showDiff}
          onChange={setLocalContent}
          onStats={setEditorStats}
          onViewCreated={setView}
        />
      </div>

      <RepoStatusBar meta={fileData.meta} readOnly={mode === "view"} stats={editorStats} />
    </div>
  );
}
