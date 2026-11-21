import type { Locale as DateFnsLocale } from "date-fns";
import { de, enUS, es, fr, it, ja, ko, pl, ptBR, ru, tr, zhCN } from "date-fns/locale";

import type { Locale } from "./locales";

export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = {
  de,
  en: enUS,
  es,
  fr,
  it,
  ja,
  ko,
  pl,
  "pt-BR": ptBR,
  ru,
  tr,
  "zh-CN": zhCN,
};
