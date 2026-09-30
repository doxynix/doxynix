import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/config/locales";
import { LOCALE_COOKIE_NAME } from "@/shared/i18n/routing";

/**
 * Best-supported locale from an `Accept-Language` header, or `undefined`.
 *
 * next-intl's own middleware resolves in the order URL prefix -> locale cookie
 * -> accept-language -> default (next-intl/dist/esm/development/middleware/
 * resolveLocale.js). We cannot use that entry point here because `/api/auth`
 * is excluded from the middleware, so the last two steps are reimplemented here.
 */
export function parseAcceptLanguage(
  header: string | null,
  locales: readonly Locale[],
): Locale | undefined {
  if (header == null) {
    return undefined;
  }

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const parsed = qParam == null ? 1 : Number.parseFloat(qParam.trim().slice(2));
      // RFC 9110 caps q at 1 and floors it at 0. Clamping keeps a bogus
      // `q=5` from outranking a real preference.
      const q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;

      return { index, q, tag: tag.trim() };
    })
    .filter((entry) => entry.tag !== "" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    // Language tags are case-insensitive (RFC 9110 §4.2.6). `hasLocale` is a
    // case-sensitive lookup, so canonicalize before matching: browsers send
    // `pt-br` as often as `pt-BR`.
    const lower = tag.toLowerCase();
    const canonical = locales.find((locale) => locale.toLowerCase() === lower);

    if (canonical != null) {
      return canonical;
    }

    // `ru-RU` -> `ru`. A regional variant of a supported language still
    // resolves; an unsupported one falls through to the next candidate.
    const base = lower.split("-")[0];
    const baseMatch = locales.find((locale) => locale.toLowerCase() === base);

    if (base != null && base !== lower && baseMatch != null) {
      return baseMatch;
    }
  }

  return undefined;
}

export async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const cookieLocale = LOCALES.find((locale) => locale === cookie);

  if (cookieLocale != null) {
    return cookieLocale;
  }

  const headerList = await headers();
  const accepted = parseAcceptLanguage(headerList.get("accept-language"), LOCALES);

  return accepted ?? DEFAULT_LOCALE;
}
