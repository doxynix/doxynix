import { parseAsStringLiteral, useQueryState } from "nuqs";

import type { TerminalFilter } from "./terminal-logs";
import { countLogs, filterLogs, logLevels, parseLogs } from "./terminal-logs";

export function useTerminalLogs(logs: string[]) {
  const [filter, setFilter] = useQueryState<TerminalFilter>(
    "logFilter",
    parseAsStringLiteral(logLevels).withDefault("all"),
  );

  const [search] = useQueryState("search", { defaultValue: "" });

  const parsedLogs = parseLogs(logs);
  const counts = countLogs(parsedLogs);
  const filteredLogs = filterLogs(parsedLogs, filter, search);

  return {
    counts,
    filter,
    filteredLogs,
    search,
    setFilter,
  };
}
