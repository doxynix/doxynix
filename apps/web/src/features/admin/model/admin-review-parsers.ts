import { FixStatus, PRAnalysisStatus } from "@doxynix/shared";
import { parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const REVIEW_DEFAULTS = {
  SEARCH: "",
};

export const adminReviewParsers = {
  fixStatus: parseAsStringLiteral(Object.values(FixStatus)),
  from: parseAsIsoDate,
  minRiskScore: parseAsStringLiteral(["0", "2", "4", "6", "8", "10"]),
  search: parseAsString.withDefault(REVIEW_DEFAULTS.SEARCH),
  status: parseAsStringLiteral(Object.values(PRAnalysisStatus)),
  to: parseAsIsoDate,
};

export const RISK_LEVELS = [0, 2, 4, 6, 8, 10];
