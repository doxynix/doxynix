import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ru", "de", "es", "zh-CN", "pt-BR", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

export type Locale = (typeof routing.locales)[number];
