import type { ParamTypes } from "../types/app";

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const getSingleParam = (param: ParamTypes): string | undefined => {
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
