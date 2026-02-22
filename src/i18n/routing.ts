import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

import { IS_PROD } from "@/shared/constants/env.client";
import { DEFAULT_LOCALE, LOCALES } from "@/shared/constants/locales";

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

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
