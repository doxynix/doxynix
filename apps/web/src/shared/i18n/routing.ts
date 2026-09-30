import { defineRouting } from "next-intl/routing";

import { IS_PROD } from "@/shared/config/env.flags";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";

/**
 * Name of the locale cookie next-intl writes.
 *
 * It matches next-intl's own default, but it is declared here rather than left
 * implicit so that server code outside the middleware's request scope can read
 * it off a single source instead of repeating the string.
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: IS_PROD,
  },
  localePrefix: "as-needed",
  locales: LOCALES,
});
