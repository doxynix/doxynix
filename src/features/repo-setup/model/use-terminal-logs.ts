import { useEffect, useRef, useState } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

export const logLevels = ["all", "info", "warn", "error", "success"] as const;
export type TerminalFilter = (typeof logLevels)[number];

export interface LogEntry {
  id: string;
  level: "error" | "info" | "success" | "warn";
  message: string;
  timestamp: string;
}

export function useTerminalLogs(logs: string[]) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [filter, setFilter] = useQueryState<TerminalFilter>(
    "logFilter",
    parseAsStringLiteral(logLevels).withDefault("all")
  );

  const [search] = useQueryState("search", { defaultValue: "" });

  const parsedLogs: LogEntry[] = Array.isArray(logs)
    ? logs.map((log, index) => {
        let level: "error" | "info" | "success" | "warn" = "info";
        let timestamp = "00:00:00";
        let message = log;

        if (typeof log === "string" && log.includes(":::")) {
          const [rawLevel, rawTimestamp, ...messageParts] = log.split(":::");

          if (rawLevel != null && rawLevel !== "") {
            const clean = rawLevel.toLowerCase().trim();
            if (clean === "error" || clean === "err") level = "error";
            else if (clean === "warn" || clean === "warning") level = "warn";
            else if (clean === "success" || clean === "ok") level = "success";
          }
          if (rawTimestamp != null && rawTimestamp !== "") {
            timestamp = rawTimestamp;
          }
          if (messageParts.length > 0) {
            message = messageParts.join(":::");
          }
        }

        return {
          id: `log-${index}`,
          level,
          message,
          timestamp,
        };
      })
    : [];

  const counts = { all: 0, error: 0, info: 0, success: 0, warn: 0 };
  parsedLogs.forEach((log) => {
    counts.all += 1;
    counts[log.level] += 1;
  });

  const filteredLogs = parsedLogs.filter((log) => {
    const matchesFilter = filter === "all" || log.level === filter;
    const matchesSearch = search === "" || log.message.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleScroll = () => {
    const root = scrollRef.current;
    if (root === null) return;

    const container = root.querySelector("[data-radix-scroll-area-viewport]");
    if (container === null) return;

    const { clientHeight, scrollHeight, scrollTop } = container;

    const isAtBottom = scrollHeight - scrollTop - clientHeight < 1;

    setIsAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    const root = scrollRef.current;
    if (root !== null) {
      const container = root.querySelector("[data-radix-scroll-area-viewport]");
      if (container !== null) {
        container.scrollTo({
          behavior: "smooth",
          top: container.scrollHeight,
        });
        setIsAutoScroll(true);
      }
    }
  };

  useEffect(() => {
    const root = scrollRef.current;
    if (root === null) return;

    const container = root.querySelector("[data-radix-scroll-area-viewport]");
    if (container === null) return;

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [filteredLogs]);

  useEffect(() => {
    const root = scrollRef.current;
    if (root !== null && isAutoScroll) {
      const container = root.querySelector("[data-radix-scroll-area-viewport]");
      if (container !== null) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [filteredLogs, isAutoScroll]);

  return {
    counts,
    filter,
    filteredLogs,
    handleScroll,
    scrollRef,
    scrollToBottom,
    search,
    setFilter,
    showScrollButton,
  };
}
