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

  return {
    counts,
    filter,
    filteredLogs,
    search,
    setFilter,
  };
}
