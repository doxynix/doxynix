import { FixStatus, PRAnalysisStatus } from "@doxynix/shared";
import { parseAsInteger, parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const REVIEW_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const adminReviewParsers = {
  fixStatus: parseAsStringLiteral(Object.values(FixStatus)),
  from: parseAsIsoDate,
  minRiskScore: parseAsStringLiteral(["0", "2", "4", "6", "8", "10"]),
  page: parseAsInteger.withDefault(REVIEW_DEFAULTS.PAGE),
  search: parseAsString.withDefault(REVIEW_DEFAULTS.SEARCH),
  status: parseAsStringLiteral(Object.values(PRAnalysisStatus)),
  to: parseAsIsoDate,
};

export const RISK_LEVELS = [0, 2, 4, 6, 8, 10];
