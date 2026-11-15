import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

import { MAX_CUSTOM_RANGE_DAYS } from "@/shared/lib/analytics-periods";
import type { DateRangePreset } from "@/shared/ui/kit/app-date-range";

export type DateRangeState = { from: Date | null; period: string; to: Date | null };

export type DatePeriod = DateRangePreset;

const DAY_MS = 86_400_000;
const DEFAULT_CUSTOM_RANGE_DAYS = 30;
// One day short of the server cap, so a DST-shifted local-midnight span cannot hit the boundary.
const MAX_WRITABLE_SPAN_MS = (MAX_CUSTOM_RANGE_DAYS - 1) * DAY_MS;

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
  if (to.getTime() - from.getTime() <= MAX_WRITABLE_SPAN_MS) {
    return { from, to };
  }
  return { from: new Date(to.getTime() - MAX_WRITABLE_SPAN_MS), to };
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

  const clamped = clampCustomRange(from, end).from;

  return clamped.getTime() === from.getTime() ? null : { from: clamped, to: end };
}

export function hasUrlStateChanged(prev: DateRangeState, next: DateRangeState): boolean {
  return (
    prev.from?.getTime() !== next.from?.getTime() ||
    prev.to?.getTime() !== next.to?.getTime() ||
    prev.period !== next.period
  );
}
