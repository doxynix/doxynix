"use client";

import { ArrowDown, Terminal as TerminalIcon } from "lucide-react";

import { useAutoScroll } from "@/shared/hooks/use-auto-scroll";
import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { type LogEntry, useTerminalLogs } from "../model/use-terminal-logs";

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
  const { counts, filter, filteredLogs, search, setFilter } = useTerminalLogs(logs);

  const { scrollRef, scrollToBottom, showScrollButton } = useAutoScroll<HTMLDivElement>([
    filteredLogs,
  ]);

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

          <Tabs onValueChange={(value) => void setFilter(value as typeof filter)} value={filter}>
            <TabsList className="flex items-center gap-1">
              <TabsTrigger className="text-xs" value="all">
                All <AppBadge variant="outline">{counts.all}</AppBadge>
              </TabsTrigger>
              {counts.error > 0 && (
                <TabsTrigger className="data-[state=active]:text-destructive" value="error">
                  Errors
                  <AppBadge className="border-destructive text-destructive" variant="outline">
                    {counts.error}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.warn > 0 && (
                <TabsTrigger className="data-[state=active]:text-warning" value="warn">
                  Warns
                  <AppBadge className="border-warning text-warning" variant="outline">
                    {counts.warn}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.success > 0 && (
                <TabsTrigger className="data-[state=active]:text-success" value="success">
                  Success
                  <AppBadge className="border-success text-success" variant="outline">
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
            className="opacity-100"
            tooltipText="Copy filtered logs"
            value={clipboardValue}
          />
        </div>
      </div>

      <div className="group relative">
        <ScrollArea className={cn("w-full p-4 font-mono text-xs", maxHeight)} ref={scrollRef}>
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
          className={cn(
            "absolute bottom-4 left-1/2 z-10 size-7 -translate-x-1/2 rounded-full border transition-standard",
            showScrollButton
              ? "pointer-events-auto scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0",
          )}
          onClick={() => scrollToBottom("smooth")}
          size="sm"
          variant="secondary"
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
    <div className="flex items-start gap-3 rounded-xl p-2 font-mono transition-colors hover:bg-accent">
      {log.timestamp !== "" && <span className="select-none text-xs">[{log.timestamp}]</span>}

      <div
        className={cn(
          "wrap-break-word flex-1 whitespace-pre-wrap",
          levelColors[log.level] || levelColors.info,
        )}
      >
        {highlightText(log.message, searchQuery)}
      </div>
    </div>
  );
}

function highlightText(text: string, highlight: string) {
  if (highlight.trim() === "") {
    return text;
  }

  const escaped = highlight.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span className="rounded-[1px] bg-warning/10 font-bold text-warning" key={i}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}
