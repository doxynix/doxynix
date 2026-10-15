import { parseAsIsoDate, parseAsString } from "nuqs/server";

export const DASHBOARD_DEFAULT_PERIOD = "30d";

export const dashboardParsers = {
  from: parseAsIsoDate,
  period: parseAsString.withDefault(DASHBOARD_DEFAULT_PERIOD),
  to: parseAsIsoDate,
};

type DashboardRangeUrlState = {
  from?: Date | null;
  period?: string | null;
  to?: Date | null;
};

export function dashboardRangeInput({ from, period, to }: DashboardRangeUrlState) {
  return {
    from: from ?? undefined,
    period: period ?? DASHBOARD_DEFAULT_PERIOD,
    to: to ?? undefined,
  };
}
