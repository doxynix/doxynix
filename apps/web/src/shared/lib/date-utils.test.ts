import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALES, type Locale } from "@/shared/config/locales";
import { formatFullDate, formatRelativeTime } from "@/shared/lib/date-utils";

// Golden values captured from the test runtime (TZ=UTC, fake clock 2026-02-27T12:00:00Z).
const RELATIVE_YESTERDAY: Record<Locale, string> = {
  de: "gestern",
  en: "yesterday",
  es: "ayer",
  fr: "hier",
  "pt-BR": "ontem",
  ru: "вчера",
  "zh-CN": "昨天",
};

const RELATIVE_LAST_MONTH: Record<Locale, string> = {
  de: "letzten Monat",
  en: "last month",
  es: "el mes pasado",
  fr: "le mois dernier",
  "pt-BR": "mês passado",
  ru: "в прошлом месяце",
  "zh-CN": "上个月",
};

// Written-date portion only — ordering is stable per locale, while the time-plus-separator
// suffix (e.g. "at 03:04", "г. в 03:04") can vary across ICU versions.
const FULL_DATE_PART: Record<Locale, string> = {
  de: "2. Januar 2026",
  en: "January 2, 2026",
  es: "2 de enero de 2026",
  fr: "2 janvier 2026",
  "pt-BR": "2 de janeiro de 2026",
  ru: "2 января 2026",
  "zh-CN": "2026年1月2日",
};

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the default value for null and invalid dates", () => {
    const defaultValue = "N/A";
    expect(formatRelativeTime(null, "en", defaultValue)).toBe(defaultValue);
    expect(formatRelativeTime("not-a-date", "en", defaultValue)).toBe(defaultValue);
  });

  it.each(LOCALES)("formats yesterday for %s", (locale) => {
    const yesterday = new Date("2026-02-26T12:00:00.000Z");
    expect(formatRelativeTime(yesterday, locale)).toBe(RELATIVE_YESTERDAY[locale]);
  });

  it.each(LOCALES)("formats one month ago for %s", (locale) => {
    const lastMonth = new Date("2026-01-27T12:00:00.000Z");
    expect(formatRelativeTime(lastMonth, locale)).toBe(RELATIVE_LAST_MONTH[locale]);
  });
});

describe("formatFullDate", () => {
  it.each(LOCALES)("formats the date for %s", (locale) => {
    expect(formatFullDate("2026-01-02T03:04:00.000Z", locale)).toContain(FULL_DATE_PART[locale]);
  });

  it("returns dash fallback for invalid dates", () => {
    expect(formatFullDate("invalid-date", "en")).toBe("—");
  });
});
