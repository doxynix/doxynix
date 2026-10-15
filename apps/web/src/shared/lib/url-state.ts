import type { SearchParams } from "nuqs/server";

type ParserLike = { parse: (value: string) => unknown };

export function urlStateFromSearchParams<P extends Record<string, ParserLike>>(
  parsers: P,
  query: SearchParams,
): { [K in keyof P]: ReturnType<P[K]["parse"]> } {
  const state: Record<string, unknown> = {};

  for (const [key, parser] of Object.entries(parsers)) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    state[key] = value == null ? null : parser.parse(value);
  }

  return state as { [K in keyof P]: ReturnType<P[K]["parse"]> };
}

export function hasAnySearchParam(query: SearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => query[key] != null);
}
