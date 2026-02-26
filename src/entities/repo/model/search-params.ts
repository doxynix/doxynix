import { getSingleParam, parseEnum, parseStringUnion } from "@/shared/lib/url-params";
import type { ParamTypes } from "@/shared/types/app";

import { StatusSchema, VisibilitySchema } from "@/generated/zod";

export const REPO_DEFAULTS = {
  LIMIT: 5,
  PAGE: 1,
  SORT_BY: "updatedAt" as const,
  SORT_ORDER: "desc" as const,
  STATUS: undefined,
  VISIBILITY: undefined,
};

export const parseRepoSearchParams = (params: { [key: string]: ParamTypes }) => {
  const rawPage = Number(getSingleParam(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : REPO_DEFAULTS.PAGE;

  return {
    owner: getSingleParam(params.owner),
    page,
    search: getSingleParam(params.search) ?? "",
    sortBy: parseStringUnion(params.sortBy, VALID_SORT_FIELDS, REPO_DEFAULTS.SORT_BY),
    sortOrder: parseStringUnion(params.sortOrder, ["asc", "desc"], REPO_DEFAULTS.SORT_ORDER),
    status: parseEnum(params.status, StatusSchema.enum),
    visibility: parseEnum(params.visibility, VisibilitySchema.enum),
  };
};

export const VALID_SORT_FIELDS = ["updatedAt", "createdAt", "name"] as const;
export type RepoSortField = (typeof VALID_SORT_FIELDS)[number];
