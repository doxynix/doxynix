export const logLevels = ["all", "info", "warn", "error", "success"] as const;
export type TerminalFilter = (typeof logLevels)[number];

export interface LogEntry {
  id: string;
  level: "error" | "info" | "success" | "warn";
  message: string;
  timestamp: string;
}

export type LogCounts = Record<TerminalFilter, number>;

/**
 * Разбирает строки логов вида "LEVEL:::TIMESTAMP:::MESSAGE" в структурированные
 * записи. Строки без разделителя ":::" остаются как есть (level=info).
 */
export const parseLogs = (logs: string[]): LogEntry[] =>
  Array.isArray(logs)
    ? logs.map((log, index) => {
        let level: LogEntry["level"] = "info";
        let timestamp = "00:00:00";
        let message = log;

        if (typeof log === "string" && log.includes(":::")) {
          const [rawLevel, rawTimestamp, ...messageParts] = log.split(":::");

          if (rawLevel != null && rawLevel !== "") {
            const clean = rawLevel.toLowerCase().trim();
            if (clean === "error" || clean === "err") {
              level = "error";
            } else if (clean === "warn" || clean === "warning") {
              level = "warn";
            } else if (clean === "success" || clean === "ok") {
              level = "success";
            }
          }
          if (rawTimestamp != null && rawTimestamp !== "") {
            timestamp = rawTimestamp;
          }
          if (messageParts.length > 0) {
            message = messageParts.join(":::");
          }
        }

        return { id: `log-${index}`, level, message, timestamp };
      })
    : [];

export const countLogs = (logs: LogEntry[]): LogCounts => {
  const counts: LogCounts = { all: 0, error: 0, info: 0, success: 0, warn: 0 };
  logs.forEach((log) => {
    counts.all += 1;
    counts[log.level] += 1;
  });
  return counts;
};

export const filterLogs = (logs: LogEntry[], filter: TerminalFilter, search: string): LogEntry[] =>
  logs.filter((log) => {
    const matchesFilter = filter === "all" || log.level === filter;
    const matchesSearch = search === "" || log.message.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });
