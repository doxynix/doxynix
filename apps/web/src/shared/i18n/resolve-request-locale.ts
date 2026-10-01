import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/shared/config/locales";
import { LOCALE_COOKIE_NAME } from "@/shared/i18n/routing";

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
      const q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;

      return { index, q, tag: tag.trim() };
    })
    .filter((entry) => entry.tag !== "" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    const lower = tag.toLowerCase();
    const canonical = locales.find((locale) => locale.toLowerCase() === lower);

    if (canonical != null) {
      return canonical;
    }

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
