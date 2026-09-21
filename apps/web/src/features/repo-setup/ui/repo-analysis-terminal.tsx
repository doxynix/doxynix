"use client";

import { ArrowDown, Terminal as TerminalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { useAutoScroll } from "@/shared/lib/hooks/use-auto-scroll";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/core/tabs";
import { AppSearch } from "@/shared/ui/kit/app-search";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { LogEntry } from "../model/terminal-logs";
import { computeTextHighlight } from "../model/terminal-logs";
import { useTerminalLogs } from "../model/use-terminal-logs";

type Props = {
  logs: string[];
  maxHeight?: string;
  title?: string;
};

export function AnalysisTerminal({ logs, maxHeight = "h-75", title }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const defaultTitle = t("repo_terminal_title");
  const displayTitle = title ?? defaultTitle;
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
            <span className="text-foreground">{displayTitle}</span>
          </div>

          <Tabs
            onValueChange={(value) => void setFilter(value as typeof filter)}
            value={filter}
          >
            <TabsList className="flex items-center gap-1">
              <TabsTrigger
                className="text-xs"
                value="all"
              >
                {t("repo_terminal_tab_all")} <AppBadge variant="outline">{counts.all}</AppBadge>
              </TabsTrigger>
              {counts.error > 0 && (
                <TabsTrigger
                  className="data-[state=active]:text-destructive"
                  value="error"
                >
                  {t("repo_terminal_tab_errors")}
                  <AppBadge
                    className="border-destructive text-destructive"
                    variant="outline"
                  >
                    {counts.error}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.warn > 0 && (
                <TabsTrigger
                  className="data-[state=active]:text-warning"
                  value="warn"
                >
                  {t("repo_terminal_tab_warns")}
                  <AppBadge
                    className="border-warning text-warning"
                    variant="outline"
                  >
                    {counts.warn}
                  </AppBadge>
                </TabsTrigger>
              )}

              {counts.success > 0 && (
                <TabsTrigger
                  className="data-[state=active]:text-success"
                  value="success"
                >
                  {t("repo_terminal_tab_success")}
                  <AppBadge
                    className="border-success text-success"
                    variant="outline"
                  >
                    {counts.success}
                  </AppBadge>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <AppSearch placeholder={t("repo_terminal_search_placeholder")} />
          <CopyButton
            className="opacity-100"
            tooltipText={t("repo_terminal_copy_logs")}
            value={clipboardValue}
          />
        </div>
      </div>

      <div className="group relative">
        <ScrollArea
          className={cn("w-full p-4 font-mono text-xs", maxHeight)}
          ref={scrollRef}
        >
          {filteredLogs.length === 0 && logs.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p>{t("repo_terminal_no_matches")}</p>
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
              <LogLine
                key={log.id}
                log={log}
                searchQuery={search}
              />
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

  const tokens = computeTextHighlight(log.message, searchQuery);

  return (
    <div className="flex items-start gap-3 rounded-xl p-2 font-mono transition-colors hover:bg-accent">
      {log.timestamp !== "" && (
        <span className="select-none text-xs">{`[` + log.timestamp + `]`}</span>
      )}

      <div
        className={cn(
          "wrap-break-word flex-1 whitespace-pre-wrap",
          levelColors[log.level] || levelColors.info,
        )}
      >
        {tokens.map((token, i) =>
          token.isHighlighted ? (
            <span
              className="rounded-[1px] bg-warning/10 font-bold text-warning"
              key={i}
            >
              {token.text}
            </span>
          ) : (
            token.text
          ),
        )}
      </div>
    </div>
  );
}
