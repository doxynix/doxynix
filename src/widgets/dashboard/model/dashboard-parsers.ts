import { parseAsIsoDate, parseAsString } from "nuqs";

export const dashboardParsers = {
  from: parseAsIsoDate,
  period: parseAsString,
  to: parseAsIsoDate,
};
