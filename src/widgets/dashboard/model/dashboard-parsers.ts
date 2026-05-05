import { parseAsIsoDate, parseAsString } from "nuqs";

export const dashboardParsers = {
  from: parseAsIsoDate,
  period: parseAsString.withDefault("30d"),
  to: parseAsIsoDate,
};
