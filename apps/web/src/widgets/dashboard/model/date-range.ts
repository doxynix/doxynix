import type { DateRange } from "react-day-picker";

import type { DateRangePreset } from "@/shared/ui/kit/app-date-range";

export type DateRangeState = { from: Date | null; period: string; to: Date | null };

export type DatePeriod = DateRangePreset;

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

export function hasUrlStateChanged(prev: DateRangeState, next: DateRangeState): boolean {
  return (
    prev.from?.getTime() !== next.from?.getTime() ||
    prev.to?.getTime() !== next.to?.getTime() ||
    prev.period !== next.period
  );
}
