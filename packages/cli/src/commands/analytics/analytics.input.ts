import { parseDateArg } from "@/ui/formatters";

import type { DashboardStatsInput, TrendsInput } from "./analytics.types";

export type AnalyticsCliOptions = {
  from?: string;
  json?: boolean;
  repo?: string;
  to?: string;
};

export type InputBuildResult<T> = { input: T; ok: true } | { message: string; ok: false };

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

// Returns a Date, a validation message, or null when the flag was not supplied.
function parseFlag(value: string | undefined, flag: "--from" | "--to"): Date | null | string {
  if (!value) {
    return null;
  }
  const parsed = parseDateArg(value);
  return parsed ?? `Invalid ${flag} date format: '${value}'. Expected YYYY-MM-DD.`;
}

// The server needs both bounds on a custom period and rejects a span over 366 days, so a one-sided
// flag is completed here instead of sending an input the schema would refuse.
function completeRange(from: Date | null, to: Date | null): { from: Date; to: Date } {
  const end = to ?? new Date();

  if (from == null) {
    return { from: new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS), to: end };
  }

  const maxSpanMs = (MAX_RANGE_DAYS - 1) * DAY_MS;

  return {
    from: end.getTime() - from.getTime() > maxSpanMs ? new Date(end.getTime() - maxSpanMs) : from,
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

export function buildTrendsInput(
  options: AnalyticsCliOptions,
  repoId?: string,
): InputBuildResult<TrendsInput> {
  const input: TrendsInput = {};
  if (repoId) {
    input.repoId = repoId;
  }

  const to = parseFlag(options.to, "--to");
  if (typeof to === "string") {
    return { message: to, ok: false };
  }
  if (to) {
    const range = completeRange(null, to);
    input.from = range.from;
    input.to = range.to;
    input.period = "custom";
  }

  return { input, ok: true };
}
