type LocaleMeta = {
  flag: string;
  labelKey: string;
  ogLocale: string;
};

const LOCALE_CONFIG = {
  de: {
    flag: "/icons/flags/de.svg",
    labelKey: "settings_language_de",
    ogLocale: "de_DE",
  },
  en: {
    flag: "/icons/flags/us.svg",
    labelKey: "settings_language_en",
    ogLocale: "en_US",
  },
  es: {
    flag: "/icons/flags/es.svg",
    labelKey: "settings_language_es",
    ogLocale: "es_ES",
  },
  fr: {
    flag: "/icons/flags/fr.svg",
    labelKey: "settings_language_fr",
    ogLocale: "fr_FR",
  },
  it: {
    flag: "/icons/flags/it.svg",
    labelKey: "settings_language_it",
    ogLocale: "it_IT",
  },
  ja: {
    flag: "/icons/flags/jp.svg",
    labelKey: "settings_language_ja",
    ogLocale: "ja_JP",
  },
  ko: {
    flag: "/icons/flags/kr.svg",
    labelKey: "settings_language_ko",
    ogLocale: "ko_KR",
  },
  pl: {
    flag: "/icons/flags/pl.svg",
    labelKey: "settings_language_pl",
    ogLocale: "pl_PL",
  },
  "pt-BR": {
    flag: "/icons/flags/br.svg",
    labelKey: "settings_language_pt_br",
    ogLocale: "pt_BR",
  },
  ru: {
    flag: "/icons/flags/ru.svg",
    labelKey: "settings_language_ru",
    ogLocale: "ru_RU",
  },
  tr: {
    flag: "/icons/flags/tr.svg",
    labelKey: "settings_language_tr",
    ogLocale: "tr_TR",
  },
  "zh-CN": {
    flag: "/icons/flags/cn.svg",
    labelKey: "settings_language_zh_cn",
    ogLocale: "zh_CN",
  },
} as const satisfies Record<string, LocaleMeta>;

export const DEFAULT_LOCALE = "en";

export type Locale = keyof typeof LOCALE_CONFIG;

export const LOCALES = Object.keys(LOCALE_CONFIG) as Locale[];

export const LOCALE_REGEX_STR = LOCALES.join("|");

export const FLAGS = Object.fromEntries(
  LOCALES.map((locale) => [locale, LOCALE_CONFIG[locale].flag]),
) as Record<Locale, string>;

export const LOCALE_LABEL_KEYS = Object.fromEntries(
  LOCALES.map((locale) => [locale, LOCALE_CONFIG[locale].labelKey]),
) as Record<Locale, (typeof LOCALE_CONFIG)[Locale]["labelKey"]>;

export function isLocale(value: string): value is Locale {
  return value in LOCALE_CONFIG;
}

export function getOgLocale(locale: string): string {
  return isLocale(locale) ? LOCALE_CONFIG[locale].ogLocale : LOCALE_CONFIG[DEFAULT_LOCALE].ogLocale;
}
