import { ANALYTICS_MAX_RANGE_DAYS } from "@doxynix/shared";

import { parseDateArg } from "@/ui/formatters";

import type { DashboardStatsInput } from "./analytics.types";

export type AnalyticsCliOptions = {
  from?: string;
  json?: boolean;
  repo?: string;
  to?: string;
};

export type InputBuildResult<T> = { input: T; ok: true } | { message: string; ok: false };

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_SPAN_MS = (ANALYTICS_MAX_RANGE_DAYS - 1) * DAY_MS;

// Returns a Date, a validation message, or null when the flag was not supplied.
function parseFlag(value: string | undefined, flag: "--from" | "--to"): Date | null | string {
  if (!value) {
    return null;
  }
  const parsed = parseDateArg(value);
  return parsed ?? `Invalid ${flag} date format: '${value}'. Expected YYYY-MM-DD.`;
}

// The server needs both bounds on a custom period and rejects a span over the cap, so a one-sided
// flag is completed here instead of sending an input the schema would refuse.
function completeRange(from: Date | null, to: Date | null): { from: Date; to: Date } {
  const end = to ?? new Date();
  let start = from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

  // A lone future `--from` would complete to a range that runs backwards.
  if (start.getTime() > end.getTime()) {
    start = new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  }

  return {
    from:
      end.getTime() - start.getTime() > MAX_SPAN_MS ? new Date(end.getTime() - MAX_SPAN_MS) : start,
    to: end,
  };
}

export function buildAnalyticsInput(
  options: AnalyticsCliOptions,
  repoId?: string,
): InputBuildResult<DashboardStatsInput> {
  const input: DashboardStatsInput = {};
  if (repoId) {
    input.repoId = repoId;
  }

  const from = parseFlag(options.from, "--from");
  if (typeof from === "string") {
    return { message: from, ok: false };
  }

  const to = parseFlag(options.to, "--to");
  if (typeof to === "string") {
    return { message: to, ok: false };
  }

  if (from && to && from.getTime() > to.getTime()) {
    return {
      message: `Invalid date range: --from (${options.from}) cannot be later than --to (${options.to}).`,
      ok: false,
    };
  }

  // The server ignores from/to unless the period is explicit, defaulting it to 30d.
  if (from != null || to != null) {
    const range = completeRange(from, to);
    input.from = range.from;
    input.to = range.to;
    input.period = "custom";
  }

  return { input, ok: true };
}
