import { AuditModel, AuditOperation } from "@doxynix/shared";
import { parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const AUDIT_DEFAULTS = {
  SEARCH: "",
};

export const adminAuditParsers = {
  from: parseAsIsoDate,
  model: parseAsStringLiteral(Object.values(AuditModel)),
  operation: parseAsStringLiteral(Object.values(AuditOperation)),
  search: parseAsString.withDefault(AUDIT_DEFAULTS.SEARCH),
  to: parseAsIsoDate,
};
