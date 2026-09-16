import type { DateRange } from "react-day-picker";

export type DateRangeState = { from: Date | null; period: string; to: Date | null };

export type DatePeriod = { getValue: () => DateRange; period: string };

export function resolveDateRange(
  from: Date | null,
  to: Date | null,
  period: string,
  periods: ReadonlyArray<DatePeriod>,
): DateRange | undefined {
  if (from && to) {
    return { from, to };
  }
  return periods.find((p) => p.period === period)?.getValue();
}

export function hasUrlStateChanged(prev: DateRangeState, next: DateRangeState): boolean {
  return (
    prev.from?.getTime() !== next.from?.getTime() ||
    prev.to?.getTime() !== next.to?.getTime() ||
    prev.period !== next.period
  );
}
