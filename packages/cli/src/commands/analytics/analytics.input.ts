import { parseDateArg } from "@/ui/formatters";

import type { DashboardStatsInput, TrendsInput } from "./analytics.types";

export type AnalyticsCliOptions = {
  from?: string;
  json?: boolean;
  repo?: string;
  to?: string;
};

export type InputBuildResult<T> = { input: T; ok: true } | { message: string; ok: false };

// Returns a Date, a validation message, or null when the flag was not supplied.
function parseFlag(value: string | undefined, flag: "--from" | "--to"): Date | null | string {
  if (!value) {
    return null;
  }
  const parsed = parseDateArg(value);
  return parsed ?? `Invalid ${flag} date format: '${value}'. Expected YYYY-MM-DD.`;
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
  if (from) {
    input.from = from;
  }

  const to = parseFlag(options.to, "--to");
  if (typeof to === "string") {
    return { message: to, ok: false };
  }
  if (to) {
    input.to = to;
  }

  if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
    return {
      message: `Invalid date range: --from (${options.from}) cannot be later than --to (${options.to}).`,
      ok: false,
    };
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
    input.to = to;
  }

  return { input, ok: true };
}
