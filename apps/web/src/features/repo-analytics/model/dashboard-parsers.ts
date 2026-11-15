import { parseAsIsoDate, parseAsStringLiteral } from "nuqs/server";

import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@/shared/lib/analytics-periods";

export const DASHBOARD_DEFAULT_PERIOD = "30d";

export const dashboardParsers = {
  from: parseAsIsoDate,
  // An unknown `?period=` falls back to the default instead of reaching the analytics input.
  period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault(DASHBOARD_DEFAULT_PERIOD),
  to: parseAsIsoDate,
};

type DashboardRangeUrlState = {
  from?: Date | null;
  period?: AnalyticsPeriod | null;
  to?: Date | null;
};

export function dashboardRangeInput({ from, period, to }: DashboardRangeUrlState) {
  return {
    from: from ?? undefined,
    period: period ?? DASHBOARD_DEFAULT_PERIOD,
    to: to ?? undefined,
  };
}
