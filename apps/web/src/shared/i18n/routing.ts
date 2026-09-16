import { defineRouting } from "next-intl/routing";

import { IS_PROD } from "@/shared/config/env.flags";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/config/locales";

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: {
    path: "/",
    sameSite: "lax",
    secure: IS_PROD,
  },
  localePrefix: "as-needed",
  locales: LOCALES,
});
