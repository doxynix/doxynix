const compactFormatters = new Map<string, Intl.NumberFormat>();

export function formatCompactNumber(value: number, locale: string): string {
  let formatter = compactFormatters.get(locale);

  if (formatter == null) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      notation: "compact",
    });
    compactFormatters.set(locale, formatter);
  }

  return formatter.format(value);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatUsageDate(date: Date, locale: string): string {
  let formatter = dateFormatters.get(locale);

  if (formatter == null) {
    formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    dateFormatters.set(locale, formatter);
  }

  return formatter.format(date);
}
