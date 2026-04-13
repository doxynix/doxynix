import { Temporal } from "temporal-polyfill";

import { DEFAULT_LOCALE } from "../constants/locales";

export function formatRelativeTime(
  date: Date | null | number | string,
  localeStr: string = DEFAULT_LOCALE,
  defaultValue: string = "вЂ”"
): string {
  if (date == null) return defaultValue;

  try {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return defaultValue;

    const timeZone = Temporal.Now.timeZoneId();
    const nowZdt = Temporal.Now.zonedDateTimeISO(timeZone);
    const targetZdt = Temporal.Instant.fromEpochMilliseconds(
      parsedDate.getTime()
    ).toZonedDateTimeISO(timeZone);
    const duration = nowZdt.since(targetZdt, { largestUnit: "year" });
    const formatter = new Intl.RelativeTimeFormat(localeStr, { numeric: "auto" });
    const sign = duration.sign < 0 ? 1 : -1;

    const years = Math.abs(duration.years);
    const months = Math.abs(duration.months);
    const weeks = Math.abs(duration.weeks);
    const days = Math.abs(duration.days);
    const hours = Math.abs(duration.hours);
    const minutes = Math.abs(duration.minutes);

    if (years > 0) return formatter.format(sign * years, "year");
    if (months > 0) return formatter.format(sign * months, "month");
    if (weeks > 0) return formatter.format(sign * weeks, "week");
    if (days > 0) return formatter.format(sign * days, "day");
    if (hours > 0) return formatter.format(sign * hours, "hour");

    return formatter.format(sign * Math.max(1, minutes), "minute");
  } catch (error) {
    console.error("Date formatting error:", error);
    return defaultValue;
  }
}

export function formatFullDate(
  date: Date | number | string,
  localeStr: string = DEFAULT_LOCALE
): string {
  try {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "вЂ”";

    const instant = Temporal.Instant.fromEpochMilliseconds(parsedDate.getTime());

    return instant.toLocaleString(localeStr, {
      day: "numeric",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "long",
      timeZone: Temporal.Now.timeZoneId(),
      year: "numeric",
    });
  } catch {
    return "вЂ”";
  }
}
