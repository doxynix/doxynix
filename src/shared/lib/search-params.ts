import { Status, Visibility } from "@prisma/client";

export const REPO_DEFAULTS = {
  LIMIT: 5,
  PAGE: 1,
  SORT_BY: "updatedAt" as const,
  SORT_ORDER: "desc" as const,
  STATUS: undefined,
  VISIBILITY: undefined,
};

type ParamTypes = string | string[] | undefined;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const VALID_SORT_FIELDS = ["updatedAt", "createdAt", "name"] as const;
export type RepoSortField = (typeof VALID_SORT_FIELDS)[number];

const getSingleParam = (param: ParamTypes): string | undefined => {
  return Array.isArray(param) ? param[0] : param;
};

export const parseEnum = <T extends string>(
  value: ParamTypes,
  enumObj: Record<string, T>
): T | undefined => {
  const str = getSingleParam(value);
  if (!isNonEmptyString(str)) {
    return undefined;
  }
  return Object.values(enumObj).includes(str as T) ? (str as T) : undefined;
};

export const parseStringUnion = <T extends string>(
  value: ParamTypes,
  validValues: readonly T[],
  defaultValue: T
): T => {
  const str = getSingleParam(value);
  if (!isNonEmptyString(str)) {
    return defaultValue;
  }
  return validValues.includes(str as T) ? (str as T) : defaultValue;
};

export const parseRepoSearchParams = (params: { [key: string]: ParamTypes }) => {
  return {
    owner: getSingleParam(params.owner),
    page: Number(getSingleParam(params.page)) || REPO_DEFAULTS.PAGE,

    search: getSingleParam(params.search) ?? "",

    sortBy: parseStringUnion(params.sortBy, VALID_SORT_FIELDS, REPO_DEFAULTS.SORT_BY),

    sortOrder: parseStringUnion(params.sortOrder, ["asc", "desc"], REPO_DEFAULTS.SORT_ORDER),
    status: parseEnum(params.status, Status),
    visibility: parseEnum(params.visibility, Visibility),
  };
};
