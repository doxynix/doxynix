import { ANALYTICS_MAX_RANGE_DAYS } from "@doxynix/shared";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

import type { DateRangePreset } from "@/shared/ui/kit/app-date-range";

export type DateRangeState = { from: Date | null; period: string; to: Date | null };

export type DatePeriod = DateRangePreset;

const DAY_MS = 86_400_000;
const DEFAULT_CUSTOM_RANGE_DAYS = 30;
// One day short of the server cap, so a DST-shifted local-midnight span cannot hit the boundary.
const MAX_WRITABLE_SPAN_MS = (ANALYTICS_MAX_RANGE_DAYS - 1) * DAY_MS;

export function resolveDateRange(
  from: Date | null,
  to: Date | null,
  period: string,
  periods: ReadonlyArray<DatePeriod>,
): DateRange | undefined {
  // The service ignores from/to unless the period is `custom`, so a preset must win over them.
  if (period !== "custom") {
    return periods.find((p) => p.key === period)?.getValue();
  }
  if (from == null && to == null) {
    return undefined;
  }
  return { from: from ?? undefined, to: to ?? undefined };
}

export function clampCustomRange(from: Date, to: Date): { from: Date; to: Date } {
  // A URL can carry `from` after `to`; swapping keeps both endpoints instead of discarding them.
  const start = from.getTime() <= to.getTime() ? from : to;
  const end = from.getTime() <= to.getTime() ? to : from;

  if (end.getTime() - start.getTime() <= MAX_WRITABLE_SPAN_MS) {
    return { from: start, to: end };
  }
  return { from: new Date(end.getTime() - MAX_WRITABLE_SPAN_MS), to: end };
}

// The params to write when a `custom` URL cannot pass `AnalyticsInputSchema`, or null when it can.
export function normalizeCustomRange(
  from: Date | null,
  to: Date | null,
): { from: Date; to: Date } | null {
  const end = to ?? new Date();

  if (from == null) {
    return { from: subDays(end, DEFAULT_CUSTOM_RANGE_DAYS), to: end };
  }

  const { from: start, to: finish } = clampCustomRange(from, end);
  const unchanged = start.getTime() === from.getTime() && finish.getTime() === end.getTime();

  return unchanged ? null : { from: start, to: finish };
}

export function hasUrlStateChanged(prev: DateRangeState, next: DateRangeState): boolean {
  return (
    prev.from?.getTime() !== next.from?.getTime() ||
    prev.to?.getTime() !== next.to?.getTime() ||
    prev.period !== next.period
  );
}
