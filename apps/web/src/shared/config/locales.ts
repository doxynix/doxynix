export const LOCALES = [
  "en",
  "ru",
  "de",
  "es",
  "zh-CN",
  "pt-BR",
  "fr",
  "it",
  "ja",
  "ko",
  "pl",
  "tr",
] as const;

export const DEFAULT_LOCALE = "en";

export type Locale = (typeof LOCALES)[number];

export const LOCALE_REGEX_STR = LOCALES.join("|");
