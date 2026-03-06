import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import type z from "zod";

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

export type repoParsersType = z.infer<typeof repoParsers>;
