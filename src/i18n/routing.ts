import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

import { IS_PROD } from "@/shared/constants/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/constants/locales";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeCookie: {
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
  },
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
