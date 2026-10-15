import { StatusSchema, VisibilitySchema } from "@doxynix/shared";
import { parseAsInteger, parseAsIsoDate, parseAsString, parseAsStringLiteral } from "nuqs/server";

const REPO_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const REPO_LIST_DEFAULT_LIMIT = 5;
export const REPO_LIST_DEFAULT_SORT_BY = "updatedAt";

export const repoParsers = {
  from: parseAsIsoDate,
  page: parseAsInteger.withDefault(REPO_DEFAULTS.PAGE),
  search: parseAsString.withDefault(REPO_DEFAULTS.SEARCH),
  sortBy: parseAsStringLiteral(["updatedAt", "createdAt", "name"] as const).withDefault(
    REPO_LIST_DEFAULT_SORT_BY,
  ),
  status: parseAsStringLiteral(StatusSchema.options),
  to: parseAsIsoDate,
  visibility: parseAsStringLiteral(VisibilitySchema.options),
};
