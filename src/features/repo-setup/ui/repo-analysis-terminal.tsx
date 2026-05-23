"use client";

import * as React from "react";
import { ArrowDown, Terminal as TerminalIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { useTerminalLogs, type LogEntry } from "../model/use-terminal-logs";

type Props = {
  logs: string[];
  maxHeight?: string;
  title?: string;
};

export function AnalysisTerminal({
  logs,
  maxHeight = "h-75",
  title = "Analysis Output",
}: Readonly<Props>) {
  const {
    counts,
    filter,
    filteredLogs,
    scrollRef,
    scrollToBottom,
    search,
    setFilter,
    showScrollButton,
  } = useTerminalLogs(logs);

  const clipboardValue = filteredLogs
    .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
    .join("\n");

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border text-xs">
      <div className="flex items-center justify-between gap-3 border-b p-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <TerminalIcon />
            <span className="text-foreground">{title}</span>
          </div>

          <Tabs value={filter} onValueChange={(value) => void setFilter(value as typeof filter)}>
            <TabsList className="flex items-center gap-1">
              <TabsTrigger value="all" className="text-xs">
                All <AppBadge variant="outline">{counts.all}</AppBadge>
              </TabsTrigger>
              {counts.error > 0 && (
                <TabsTrigger value="error" className="data-[state=active]:text-destructive">
                  Errors
                  <AppBadge variant="outline" className="border-destructive text-destructive">
                    {counts.error}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.warn > 0 && (
                <TabsTrigger value="warn" className="data-[state=active]:text-warning">
                  Warns
                  <AppBadge variant="outline" className="border-warning text-warning">
                    {counts.warn}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.success > 0 && (
                <TabsTrigger value="success" className="data-[state=active]:text-success">
                  Success
                  <AppBadge variant="outline" className="border-success text-success">
                    {counts.success}
                  </AppBadge>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <AppSearch placeholder="Filter terminal output..." />
          <CopyButton
            value={clipboardValue}
            tooltipText="Copy filtered logs"
            className="opacity-100"
          />
        </div>
      </div>

      <div className="group relative">
        <ScrollArea ref={scrollRef} className={cn("w-full p-4 font-mono text-xs", maxHeight)}>
          {filteredLogs.length === 0 && logs.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p>No matching logs found</p>
            </div>
          )}
          {logs.length === 0 && (
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}

          <div className="flex flex-col gap-1">
            {filteredLogs.map((log) => (
              <LogLine key={log.id} log={log} searchQuery={search} />
            ))}
          </div>
        </ScrollArea>

        <AppButton
          size="sm"
          variant="secondary"
          onClick={scrollToBottom}
          className={cn(
            "absolute right-107.5 bottom-4 left-107.5 z-10 size-7 rounded-full transition-all",
            showScrollButton
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0"
          )}
        >
          <ArrowDown />
        </AppButton>
      </div>
    </div>
  );
}

function LogLine({ log, searchQuery }: Readonly<{ log: LogEntry; searchQuery: string }>) {
  const levelColors = {
    error: "text-error",
    info: "text-foreground",
    success: "text-success",
    warn: "text-warning",
  };

  return (
    <div className="hover:bg-accent flex items-start gap-3 rounded-xl p-2 font-mono transition-colors">
      {log.timestamp !== "" && <span className="text-xs select-none">[{log.timestamp}]</span>}

      <div
        className={cn(
          "flex-1 wrap-break-word whitespace-pre-wrap",
          levelColors[log.level] || levelColors.info
        )}
      >
        {highlightText(log.message, searchQuery)}
      </div>
    </div>
  );
}

function highlightText(text: string, highlight: string) {
  if (highlight.trim() === "") return text;

  const escaped = highlight.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-warning/10 text-warning rounded-[1px] font-bold">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}
