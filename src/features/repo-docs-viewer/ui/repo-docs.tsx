"use client";

import { useState, type ComponentType } from "react";
import saveAs from "file-saver";
import { BookOpen, Download, FileText, HistoryIcon, Layers, Terminal, Users2 } from "lucide-react";

import { trpc, type AvailableDocs, type DocType } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { Button } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Tabs, TabsContent } from "@/shared/ui/core/tabs";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { RepoSwagger } from "@/entities/repo-details";

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
  onTabChange: (type: DocType) => void;
  repoId: string;
};

export function RepoDocs({ activeTab, availableDocs, onTabChange, repoId }: Readonly<Props>) {
  const [apiMode, setApiMode] = useState<"md" | "swagger">("md");
  const { data: metrics } = trpc.repoDetails.getDetailedMetrics.useQuery({ repoId });

  const { data: docContent, isLoading: isDocLoading } =
    trpc.repoDetails.getDocumentContent.useQuery({
      repoId,
      type: activeTab,
    });

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
      <RepoDocsTabs activeTab={activeTab} items={tabItems} />

      <div className="bg-card relative flex flex-1 flex-col border">
        {availableDocs.map((doc) => {
          const isCurrentApiSwagger = Boolean(
            doc.type === "API" && apiMode === "swagger" && metrics?.reference.swagger != null
          );

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
                    {isActive && !isCurrentApiSwagger && (
                      <>
                        <AppTooltip content="Download file">
                          <Button
                            disabled={isDocLoading || doc == null}
                            size="icon"
                            variant="ghost"
                            onClick={handleDownload}
                          >
                            <Download className="size-3" />
                          </Button>
                        </AppTooltip>
                        <CopyButton
                          value={docContent?.raw ?? ""}
                          disabled={isDocLoading || doc == null}
                          tooltipText="Copy file"
                          className="size-8 px-3 opacity-100"
                        />
                      </>
                    )}

                    {doc.type === "API" && metrics?.reference.swagger != null && (
                      <div className="flex gap-1 rounded-lg border p-1">
                        <Button
                          size="sm"
                          variant={apiMode === "md" ? "secondary" : "ghost"}
                          onClick={() => setApiMode("md")}
                          className="h-7 px-3 text-xs"
                        >
                          <FileText className="mr-1.5 size-3" /> Docs
                        </Button>
                        <Button
                          size="sm"
                          variant={apiMode === "swagger" ? "secondary" : "ghost"}
                          onClick={() => setApiMode("swagger")}
                          className="h-7 px-3 text-xs"
                        >
                          <Terminal className="mr-1.5 size-3" /> Console
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isCurrentApiSwagger ? (
                <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-8 pb-8 md:px-12">
                  <RepoSwagger spec={metrics?.reference.swagger ?? ""} />
                </div>
              ) : (
                <ScrollArea className="w-full flex-1">
                  <div className="px-8 pb-12 md:px-12">
                    <RepoDocsContent
                      data={isActive ? docContent : undefined}
                      isLoading={isActive ? isDocLoading : false}
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
