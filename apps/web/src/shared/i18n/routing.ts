import { defineRouting } from "next-intl/routing";

import { IS_PROD } from "@/shared/config/env.flags";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";

// Matches next-intl's own default, but declared here so server code outside the middleware request scope can read one source.
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
