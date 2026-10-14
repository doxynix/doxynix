import { BannedEmailReason } from "@doxynix/shared";
import { parseAsInteger, parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const BANNED_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const bannedEmailParsers = {
  from: parseAsIsoDate,
  page: parseAsInteger.withDefault(BANNED_DEFAULTS.PAGE),
  reason: parseAsStringLiteral(Object.keys(BannedEmailReason) as [keyof typeof BannedEmailReason]),
  search: parseAsString.withDefault(BANNED_DEFAULTS.SEARCH),
  to: parseAsIsoDate,
};
