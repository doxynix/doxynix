import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { StatusSchema, VisibilitySchema } from "@/generated/zod";

export const REPO_DEFAULTS = {
  PAGE: 1,
  SEARCH: "",
};

export const repoParsers = {
  page: parseAsInteger.withDefault(REPO_DEFAULTS.PAGE),
  search: parseAsString.withDefault(REPO_DEFAULTS.SEARCH),
  sortBy: parseAsStringLiteral(["updatedAt", "createdAt", "name"] as const).withDefault(
    "updatedAt"
  ),
  status: parseAsStringLiteral(StatusSchema.options),
  visibility: parseAsStringLiteral(VisibilitySchema.options),
};

export type repoParsersType = inferParserType<typeof repoParsers>;
