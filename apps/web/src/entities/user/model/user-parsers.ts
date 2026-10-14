import { UserRole } from "@doxynix/shared";
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const USER_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const adminUserParsers = {
  banned: parseAsBoolean,
  from: parseAsIsoDate,
  page: parseAsInteger.withDefault(USER_DEFAULTS.PAGE),
  role: parseAsStringLiteral(Object.keys(UserRole) as [keyof typeof UserRole]),
  search: parseAsString.withDefault(USER_DEFAULTS.SEARCH),
  to: parseAsIsoDate,
};
