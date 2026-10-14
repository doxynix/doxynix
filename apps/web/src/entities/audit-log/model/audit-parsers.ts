import { AuditModel, AuditOperation } from "@doxynix/shared";
import { parseAsInteger, parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const AUDIT_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const adminAuditParsers = {
  from: parseAsIsoDate,
  model: parseAsStringLiteral(Object.values(AuditModel)),
  operation: parseAsStringLiteral(Object.values(AuditOperation)),
  page: parseAsInteger.withDefault(AUDIT_DEFAULTS.PAGE),
  search: parseAsString.withDefault(AUDIT_DEFAULTS.SEARCH),
  to: parseAsIsoDate,
};
