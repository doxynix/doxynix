"use client";

import { useState, type ComponentType } from "react";
import { BookOpen, FileText, HistoryIcon, Layers, Terminal, Users2 } from "lucide-react";

import { trpc, type AvailableDocs, type DocType } from "@/shared/api/trpc";
import { formatFullDate } from "@/shared/lib/date-utils";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Tabs, TabsContent } from "@/shared/ui/core/tabs";

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

  const tabItems = availableDocs
    .map((doc) => {
      const icon = DOC_ICONS[doc.type];
      if (icon == null) return null;
      return {
        icon,
        id: doc.id,
        isFallback: doc.isFallback,
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
      className="flex h-[calc(100dvh-220px)] w-full flex-row gap-10"
    >
      <RepoDocsTabs activeTab={activeTab} items={tabItems} />

      <div className="bg-card relative flex flex-1 flex-col rounded-xl border">
        {availableDocs.map((doc) => {
          const isCurrentApiSwagger = Boolean(
            doc.type === "API" && apiMode === "swagger" && metrics?.reference.swagger != null
          );

          return (
            <TabsContent
              key={doc.type}
              value={doc.type}
              className="mt-0 flex flex-1 flex-col outline-none data-[state=inactive]:hidden"
            >
              <div className="flex-none px-8 pt-8 md:px-12">
                <div className="mb-6 flex items-center justify-between border-b pb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 rounded-md p-2">
                      {(() => {
                        const Icon = DOC_ICONS[doc.type];
                        if (Icon == null) return null;
                        return <Icon className="text-primary size-6" />;
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight capitalize">
                          {doc.type === "API" && apiMode === "swagger"
                            ? "Interactive Console"
                            : doc.type.toLowerCase().replace("_", " ")}
                        </h2>
                        {doc.status != null && (
                          <Badge
                            variant="outline"
                            className={doc.isFallback ? "border-warning text-warning" : ""}
                          >
                            {doc.isFallback ? "fallback" : doc.status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                        <span>Version: {doc.version.slice(0, 7)}</span>
                        <span>Updated: {formatFullDate(doc.updatedAt)}</span>
                        {doc.isFallback && <span>Generated from canonical analysis sections.</span>}
                      </div>
                    </div>
                  </div>

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

              {isCurrentApiSwagger ? (
                <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-8 pb-8 md:px-12">
                  {/* <RepoSwagger spec={metrics.reference.swagger} /> */}
                </div>
              ) : (
                <ScrollArea className="w-full flex-1">
                  <div className="px-8 pb-12 md:px-12">
                    <RepoDocsContent type={doc.type} repoId={repoId} />
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
