import { DEFAULT_LOCALE } from "../config/locales";

function firstGrapheme(value: string, locale: string): string {
  for (const { segment } of new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(
    value,
  )) {
    return segment;
  }
  return "";
}

export function getInitials(
  name?: null | string,
  email?: null | string,
  locale: string = DEFAULT_LOCALE,
): string {
  const trimmedName = name?.trim();

  if (trimmedName) {
    const [first, second] = trimmedName.split(/\s+/);
    if (first && second) {
      return (firstGrapheme(first, locale) + firstGrapheme(second, locale)).toLocaleUpperCase(
        locale,
      );
    }
    if (first) {
      return firstGrapheme(first, locale).toLocaleUpperCase(locale);
    }
  }

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return firstGrapheme(trimmedEmail, locale).toLocaleUpperCase(locale);
  }

  return "U";
}
