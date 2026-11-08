const DAY_MS = 86_400_000;

const PROJECTION_ALERT_DAYS = 3;
const WARNING_PERCENT = 70;
const CRITICAL_PERCENT = 90;

export const USAGE_WARNING_PERCENT = WARNING_PERCENT;
export const USAGE_CRITICAL_PERCENT = CRITICAL_PERCENT;

export type UsageSeverity = "critical" | "normal" | "warning";

export type UsageSeriesPoint = {
  date: string;
  value: number;
};

export type UsageForecastInput = {
  limit: null | number;
  now: Date;
  periodEnd: Date;
  periodStart: Date;
  series: UsageSeriesPoint[];
  used: number;
};

export type UsageChartRow = {
  actual: null | number;
  day: number;
  forecast: null | number;
};

export type UsageForecast = {
  axisMaxPercent: number;
  chartRows: UsageChartRow[];
  averagePerDay: number;
  averagePercentPerDay: number;
  daysElapsed: number;
  daysTotal: number;
  hitDay: null | number;
  percent: number;
  projectable: boolean;
  projectedPercent: number;
  projectedSeverity: UsageSeverity;
  severity: UsageSeverity;
};

function dateKeyOf(dayStart: Date): string {
  return dayStart.toISOString().slice(0, 10);
}

function percentOf(value: number, limit: null | number): number {
  return limit == null || limit <= 0 ? 0 : (value * 100) / limit;
}

// A linear axis has to stay readable for any projection: choose a step that yields roughly five
// ticks, then round the peak up to it. There is no fixed ceiling — a 311% forecast gets a 400%
// axis, a 1.9T% forecast gets a 2T% axis.
function niceAxisStep(peakPercent: number): number {
  const rough = Math.max(peakPercent, 100) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
}

function severityOf(percent: number, limit: null | number): UsageSeverity {
  if (limit == null) {
    return "normal";
  }

  if (percent >= CRITICAL_PERCENT) {
    return "critical";
  }

  if (percent >= WARNING_PERCENT) {
    return "warning";
  }

  return "normal";
}

export function buildUsageForecast(input: UsageForecastInput): UsageForecast {
  const millisTotal = Math.max(DAY_MS, input.periodEnd.getTime() - input.periodStart.getTime());
  const daysTotal = Math.max(1, Math.round(millisTotal / DAY_MS));
  const millisElapsed = Math.max(0, input.now.getTime() - input.periodStart.getTime());
  const elapsedDays = Math.min(
    daysTotal,
    Math.max(1, Math.max(millisElapsed / DAY_MS, Number.EPSILON)),
  );
  const daysElapsed = Math.min(daysTotal, Math.max(1, Math.ceil(elapsedDays)));

  const used = Math.max(0, input.used);
  const percent = percentOf(used, input.limit);
  const averagePerDay = used / elapsedDays;
  const averagePercentPerDay = percent / elapsedDays;

  // Dividing by a fraction of a day turns any early usage into a huge projection, so no forecast is
  // published until a full day of the period has elapsed.
  const projectable = millisElapsed >= DAY_MS;
  const projectedPercent = projectable
    ? percentOf(averagePerDay * daysTotal, input.limit)
    : percent;

  const rawHitDay =
    !projectable || input.limit == null || averagePerDay <= 0
      ? null
      : Math.ceil(input.limit / averagePerDay);
  const hitDay = rawHitDay != null && rawHitDay <= daysTotal ? rawHitDay : null;

  const valueByDate = new Map(input.series.map((point) => [point.date, point.value]));

  let cumulative = 0;
  const actualByDay = new Map<number, number>();

  for (let day = 1; day <= daysElapsed; day += 1) {
    const date = dateKeyOf(new Date(input.periodStart.getTime() + (day - 1) * DAY_MS));
    cumulative += valueByDate.get(date) ?? 0;
    actualByDay.set(day, percentOf(Math.max(0, cumulative), input.limit));
  }

  // The rollup is authoritative and may differ from the event sum by rounding; the last actual
  // point must agree with the number shown above the chart.
  actualByDay.set(daysElapsed, percent);

  const chartRows: UsageChartRow[] = [];

  for (let day = 1; day <= daysTotal; day += 1) {
    const actual = actualByDay.get(day) ?? null;
    let forecast: null | number = null;

    if (day === daysElapsed) {
      forecast = percent;
    } else if (day === daysTotal) {
      forecast = projectedPercent;
    } else if (day > daysElapsed) {
      forecast = projectable ? percent + (day - daysElapsed) * averagePercentPerDay : percent;
    }

    chartRows.push({ actual, day, forecast });
  }

  const peak = Math.max(percent, projectedPercent);
  const step = niceAxisStep(peak);
  const axisMaxPercent = Math.max(100, Math.ceil(peak / step) * step);

  // Actual usage and the projection are coloured independently: 20% used is not a critical state
  // just because the pace points over the limit. The projection only warns once a baseline exists.
  const projectedSeverity =
    input.limit != null && daysElapsed >= PROJECTION_ALERT_DAYS
      ? severityOf(projectedPercent, input.limit)
      : "normal";

  return {
    averagePercentPerDay,
    averagePerDay,
    axisMaxPercent,
    chartRows,
    daysElapsed,
    daysTotal,
    hitDay,
    percent,
    projectable,
    projectedPercent,
    projectedSeverity,
    severity: severityOf(percent, input.limit),
  };
}

export function dayToDate(day: number, periodStart: Date): Date {
  return new Date(periodStart.getTime() + (day - 1) * DAY_MS);
}
