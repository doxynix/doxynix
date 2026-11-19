import { UserRole } from "@doxynix/shared";
import { parseAsBoolean, parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const USER_DEFAULTS = {
  SEARCH: "",
};

export const adminUserParsers = {
  banned: parseAsBoolean,
  from: parseAsIsoDate,
  role: parseAsStringLiteral(Object.keys(UserRole) as [keyof typeof UserRole]),
  search: parseAsString.withDefault(USER_DEFAULTS.SEARCH),
  to: parseAsIsoDate,
};
