"use client";

import { useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import saveAs from "file-saver";
import {
  BookOpen,
  Download,
  FileText,
  GitBranchPlus,
  HistoryIcon,
  Layers,
  Terminal,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Spinner } from "@/shared/ui/core/spinner";
import { Tabs, TabsContent } from "@/shared/ui/core/tabs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import type { AvailableDocs, DocType, RepoNodeContext } from "@/entities/repo/model/repo.types";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { RepoDocsContent } from "./repo-docs-content";
import { RepoDocsTabs } from "./repo-docs-tabs";

const DOC_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  API: Terminal,
  ARCHITECTURE: Layers,
  CHANGELOG: HistoryIcon,
  CODE_DOC: FileText,
  CONTRIBUTING: Users2,
  README: BookOpen,
};

type Props = {
  activeTab: DocType;
  availableDocs: AvailableDocs;
  nodeContext: RepoNodeContext;
  onTabChange: (type: DocType) => void;
  repoId: string;
};

const RepoSwagger = dynamic(
  () => import("@/entities/repo/ui/repo-swagger").then((m) => m.RepoSwagger),
  {
    loading: () => (
      <div className="flex h-40 w-full items-center justify-center gap-2">
        <Spinner />
        <span>Loading Interactive Console...</span>
      </div>
    ),
    ssr: false,
  }
);

export function RepoDocs({
  activeTab,
  availableDocs,
  nodeContext,
  onTabChange,
  repoId,
}: Readonly<Props>) {
  const [apiMode, setApiMode] = useState<"md" | "swagger">("md");
  const { aid } = useRepoParams();
  const { data: metrics } = trpc.analysis.getDetailedMetrics.useQuery({
    aid: aid ?? undefined,
    repoId,
  });

  const { data: docContent, isLoading: isDocLoading } = trpc.analysis.getDocumentContent.useQuery({
    aid: aid ?? undefined,
    repoId,
    type: activeTab,
  });

  const utils = trpc.useUtils();

  const stageMutation = trpc.analysis.stageFile.useMutation({
    onError: (error) => {
      toast.error(`Failed to stage changes: ${error.message}`);
    },
    onSuccess: (data) => {
      void utils.analysis.getStagedFiles.invalidate();
      toast.success(`Changes staged for PR. Total files in draft: ${data.stagedCount}`);
    },
  });

  const headings = (() => {
    if (typeof window === "undefined" || docContent?.html == null) return [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(docContent.html, "text/html");
      const headingElements = Array.from(doc.querySelectorAll("h2, h3"));

      return headingElements.map((el) => {
        const level = el.tagName.toLowerCase() === "h2" ? 2 : 3;
        const id = el.id;

        let text = el.textContent;

        if (text.endsWith("#")) {
          text = text.slice(0, -1).trim();
        }

        return { id, level, text };
      });
    } catch (error) {
      console.error("DOMParser failed:", error);
      return [];
    }
  })();

  const [activeHeadingId, setActiveHeadingId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const headingElements = headings
      .map((h) => document.querySelector(`#${h.id}`))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveHeadingId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: "-40px 0px -75% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const handleDownload = () => {
    if (docContent?.raw == null) {
      return;
    }

    const blob = new Blob([docContent.raw], { type: "text/markdown;charset=utf-8" });
    const fileName = `${activeTab}.md`;
    saveAs(blob, fileName);
  };

  const tabItems = availableDocs
    .map((doc) => {
      const icon = DOC_ICONS[doc.type];
      if (icon == null) return null;
      return {
        icon,
        id: doc.id,
        status: doc.status,
        value: doc.type,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <Tabs
      value={activeTab}
      orientation="vertical"
      onValueChange={(value) => onTabChange(value as DocType)}
      className="flex h-[calc(100dvh-250px)] w-full flex-row gap-10"
    >
      <RepoDocsTabs
        activeHeadingId={activeHeadingId}
        activeTab={activeTab}
        headings={headings}
        items={tabItems}
      />

      <div className="bg-card relative flex flex-1 flex-col rounded-xl border">
        {availableDocs.map((doc) => {
          const isCurrentApiSwagger = Boolean(
            doc.type === "API" && apiMode === "swagger" && metrics?.reference.swagger != null
          );

          const isSwaggerReady = isCurrentApiSwagger && metrics?.reference.swagger != null;
          const isMarkdownReady = !isCurrentApiSwagger && docContent?.raw != null;
          const isReadyToStage = isSwaggerReady || isMarkdownReady;

          const isActive = doc.type === activeTab;

          return (
            <TabsContent
              key={doc.type}
              value={doc.type}
              className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
            >
              <div className="flex-none px-8 pt-8 md:px-12">
                <div className="mb-6 flex items-center justify-between border-b pb-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-md p-2">
                      {(() => {
                        const Icon = DOC_ICONS[doc.type];
                        if (Icon == null) return null;
                        return <Icon className="size-6" />;
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight capitalize">
                          {doc.type === "API" && apiMode === "swagger"
                            ? "Interactive Console"
                            : doc.type.toLowerCase().replace("_", " ")}
                        </h2>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                        <span>Version: {doc.version.slice(0, 7)}</span>
                        <span>Updated: {formatFullDate(doc.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <>
                        <AppTooltip content="Add to draft">
                          <LoadingButton
                            disabled={stageMutation.isPending || !isReadyToStage}
                            isLoading={stageMutation.isPending === true}
                            loadingText=""
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (isCurrentApiSwagger) {
                                const swaggerContent = metrics?.reference.swagger;
                                if (swaggerContent == null) return;

                                stageMutation.mutate({
                                  content: swaggerContent,
                                  filePath: "docs/openapi.yaml",
                                  repoId,
                                });
                              } else {
                                const markdownContent = docContent?.raw;
                                const materializedPath = docContent?.materializedPath;
                                if (markdownContent == null || materializedPath == null) return;

                                stageMutation.mutate({
                                  content: markdownContent,
                                  filePath: materializedPath,
                                  repoId,
                                });
                              }
                            }}
                          >
                            <GitBranchPlus />
                          </LoadingButton>
                        </AppTooltip>
                        {!isCurrentApiSwagger && (
                          <>
                            <AppTooltip content="Download file">
                              <AppButton
                                disabled={isDocLoading}
                                size="icon"
                                variant="ghost"
                                onClick={handleDownload}
                              >
                                <Download className="size-3" />
                              </AppButton>
                            </AppTooltip>
                            <CopyButton
                              disabled={isDocLoading}
                              value={docContent?.raw ?? ""}
                              tooltipText="Copy file"
                              className="size-8 px-3 opacity-100"
                            />
                          </>
                        )}
                      </>
                    )}

                    {metrics?.reference.swagger != null && (
                      <div className="flex gap-1 rounded-lg border p-1">
                        <AppButton
                          size="sm"
                          variant={apiMode === "md" ? "secondary" : "ghost"}
                          onClick={() => setApiMode("md")}
                          className="h-7 px-3 text-xs"
                        >
                          <FileText className="mr-1.5 size-3" /> Docs
                        </AppButton>
                        <AppButton
                          size="sm"
                          variant={apiMode === "swagger" ? "secondary" : "ghost"}
                          onClick={() => setApiMode("swagger")}
                          className="h-7 px-3 text-xs"
                        >
                          <Terminal className="mr-1.5 size-3" /> Console
                        </AppButton>
                      </div>
                    )}
                  </div>
                </div>

                {nodeContext != null && nodeContext.related.docs.length > 0 && (
                  <div className="mb-6 space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{nodeContext.node.label}</p>
                        <p className="text-muted-foreground text-xs">{nodeContext.explain.role}</p>
                      </div>
                      <AppBadge variant="outline">
                        {nodeContext.related.docs.length} related sections
                      </AppBadge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {nodeContext.related.docs
                        .filter((doc) => doc.docType === activeTab)
                        .slice(0, 6)
                        .map((doc) => (
                          <AppBadge key={doc.id} variant="secondary">
                            {doc.title}
                          </AppBadge>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {isCurrentApiSwagger ? (
                <div className="relative flex min-h-0 w-full flex-1 flex-col px-8 pb-8 md:px-12">
                  <RepoSwagger spec={metrics?.reference.swagger ?? ""} />
                </div>
              ) : (
                <ScrollArea className="w-full flex-1">
                  <div className="px-8 pb-12 md:px-12">
                    <RepoDocsContent
                      data={isActive ? docContent : undefined}
                      isLoading={isActive ? isDocLoading : false}
                      repoId={repoId}
                    />
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}
