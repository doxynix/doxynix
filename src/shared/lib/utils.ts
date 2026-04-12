import { Temporal } from "@js-temporal/polyfill";
import { clsx, type ClassValue } from "clsx";
import safeStringify from "fast-safe-stringify";
import * as languages from "linguist-languages";
import { twMerge } from "tailwind-merge";

import { IS_PROD } from "../constants/env.client";
import { DEFAULT_LOCALE } from "../constants/locales";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const loadedAvatars = new Map<string, boolean>();
export const loadedFlags = new Map<string, boolean>();

export function formatRelativeTime(
  date: Date | string | number | null,
  localeStr: string = DEFAULT_LOCALE,
  defaultValue: string = "—"
): string {
  if (date == null) return defaultValue;

  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return defaultValue;

    const timeZone = Temporal.Now.timeZoneId();

    const nowZdt = Temporal.Now.zonedDateTimeISO(timeZone);

    const targetZdt = Temporal.Instant.fromEpochMilliseconds(d.getTime()).toZonedDateTimeISO(
      timeZone
    );

    const duration = nowZdt.since(targetZdt, {
      largestUnit: "year",
    });

    const rtf = new Intl.RelativeTimeFormat(localeStr, { numeric: "auto" });

    const sign = duration.sign < 0 ? 1 : -1;

    const years = Math.abs(duration.years);
    const months = Math.abs(duration.months);
    const weeks = Math.abs(duration.weeks);
    const days = Math.abs(duration.days);
    const hours = Math.abs(duration.hours);
    const minutes = Math.abs(duration.minutes);

    if (years > 0) return rtf.format(sign * years, "year");
    if (months > 0) return rtf.format(sign * months, "month");
    if (weeks > 0) return rtf.format(sign * weeks, "week");
    if (days > 0) return rtf.format(sign * days, "day");
    if (hours > 0) return rtf.format(sign * hours, "hour");

    return rtf.format(sign * Math.max(1, minutes), "minute");
  } catch (error) {
    console.error("Date formatting error:", error);
    return defaultValue;
  }
}

export function formatFullDate(
  date: Date | string | number,
  localeStr: string = DEFAULT_LOCALE
): string {
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";

    const instant = Temporal.Instant.fromEpochMilliseconds(d.getTime());

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
    return "—";
  }
}

export function isGitHubUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (trimmed.includes("://")) {
    try {
      const url = new URL(trimmed);
      const protocol = url.protocol.toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") return false;

      const host = url.hostname.toLowerCase();
      const isGithubHost = host === "github.com" || host.endsWith(".github.com");
      if (!isGithubHost) return false;

      const pathParts = url.pathname.split("/").filter(Boolean);

      return pathParts.length >= 2;
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith("git@github.com:")) {
    const pathContent = trimmed.slice("git@github.com:".length);
    const parts = pathContent.split("/").filter(Boolean);

    return parts.length === 2;
  }

  const parts = trimmed.split("/").filter(Boolean);

  return parts.length === 2;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "passwordhash",
  "hash",
  "salt",
  "token",
  "sessiontoken",
  "verificationtoken",
  "gh_token",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "clientsecret",
  "hashedkey",
  "apikey",
  "cvv",
  "creditcard",
  "iban",
  "authorization",
  "cookie",
  "set-cookie",
  "identifier",
  "proxy-authorization",
  "x-github-token",
  "imagekey",
  "session_state",
  "state",
]);

const GITHUB_TOKEN_REGEX = /(github_pat_\w+|gh[pousr]_\w{36,})/g;
const BEARER_TOKEN_REGEX = /([Bb]earer\s+)[a-zA-Z0-9\-._~+/]+=*/g;

const replacer = (key: string, value: unknown): unknown => {
  const lowerKey = key.toLowerCase();
  const normalizedKey = lowerKey.replace(/[_-]/g, "");

  if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(normalizedKey)) {
    return "[REDACTED]";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    let safeString = value;
    if (safeString.includes("gh") || safeString.includes("github_pat_")) {
      safeString = safeString.replace(GITHUB_TOKEN_REGEX, "[REDACTED_GH_TOKEN]");
    }
    if (safeString.includes("earer")) {
      safeString = safeString.replace(BEARER_TOKEN_REGEX, "$1[REDACTED]");
    }
    return safeString;
  }

  return value;
};

export const sanitizePayload = (obj: unknown): unknown => {
  if (typeof obj === "string") return replacer("", obj);

  if (obj == null || typeof obj !== "object") return obj;

  try {
    const redactedString = safeStringify(obj, replacer);

    return JSON.parse(redactedString);
  } catch (error) {
    return {
      _sanitization_error: true,
      reason: error instanceof Error ? error.message : "Unknown error during stringify",
      type_was: typeof obj,
    };
  }
};

export const smoothScrollTo = (targetId: string, offset: number = 80, duration: number = 800) => {
  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
    console.warn(`Element with id #${targetId} not found`);
    return;
  }

  const startPosition = window.pageYOffset;
  const targetPosition = targetElement.getBoundingClientRect().top + startPosition - offset;
  const distance = targetPosition - startPosition;
  let startTime: number | null = null;

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const animation = (currentTime: number) => {
    startTime ??= currentTime;
    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);

    const easeProgress = easeInOutCubic(progress);

    window.scrollTo(0, startPosition + distance * easeProgress);

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  };

  requestAnimationFrame(animation);
};

export const getCookieName = () => {
  if (IS_PROD) {
    return "__Secure-next-auth.session-token";
  }
  return "next-auth.session-token";
};

export function getInitials(name?: string | null, email?: string | null): string {
  if (name != null && name.length > 0) {
    const parts = name.trim().split(" ").filter(Boolean);

    if (parts.length >= 2) {
      const first = parts[0]?.[0];
      const second = parts[1]?.[0];
      if (first != null && second != null) {
        return (first + second).toUpperCase();
      }
    }

    if (parts.length === 1) {
      const firstChar = parts[0]?.substring(0, 1);
      return (firstChar != null ? firstChar : "U").toUpperCase();
    }
  }

  if (email != null && email.length > 0) {
    return email.substring(0, 1).toUpperCase();
  }

  return "U";
}

type LinguistInfo = {
  readonly color?: string;
  readonly extensions?: readonly string[];
};

const langData = languages as Record<string, LinguistInfo | undefined>;

const findByExtension = (ext: string) => {
  const normalized = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

  const entry = Object.entries(langData).find(
    ([_, info]) => info?.extensions?.includes(normalized) ?? false
  );

  if (entry == null) return null;

  return {
    color: entry[1]?.color ?? null,
    name: entry[0],
  };
};

export const getLanguageColor = (langOrExt: string | null): string => {
  if (langOrExt == null || langOrExt === "") return "#cccccc";

  const directMatch = langData[langOrExt];
  if (directMatch != null && directMatch.color != null) {
    return directMatch.color;
  }

  const found = findByExtension(langOrExt);

  if (found?.color == null) return "#cccccc";

  return found.color;
};

export const normalizeLanguageName = (ext: string): string => {
  const found = findByExtension(ext);
  return found != null ? found.name : ext.toUpperCase();
};

export function setClientCookie(name: string, value: string | boolean, maxAge: number) {
  if (typeof window === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export const formatSize = (bytes?: number) => {
  if (bytes == null) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const getHealthColor = (score: number) => {
  if (score < 50) return "var(--destructive)";
  if (score < 80) return "var(--status-warning)";
  return "var(--status-success)";
};

export function clampIntegerParam(
  value: number | null | undefined,
  {
    fallback,
    max,
    min,
  }: {
    fallback: number;
    max: number;
    min: number;
  }
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

export function isRouteActive(
  pathname: string,
  href: string | null | undefined,
  exact?: boolean
): boolean {
  if (href == null) return false;

  const normalize = (path: string) => {
    const clean = path.replace(/\/$/, "");
    return clean === "" ? "/" : clean;
  };

  const cleanPath = normalize(pathname);
  const cleanHref = normalize(href);

  if (exact === true) {
    return cleanPath === cleanHref;
  }

  if (!cleanPath.startsWith(cleanHref)) return false;

  if (cleanHref !== "/" && cleanPath !== cleanHref && !cleanPath.startsWith(`${cleanHref}/`)) {
    return false;
  }

  if (cleanHref === "/" && cleanPath !== "/") {
    const rootSegments = cleanPath.split("/").filter(Boolean);
    return rootSegments.length <= 1;
  }

  const pathSegments = cleanPath.split("/").filter(Boolean);
  const hrefSegments = cleanHref.split("/").filter(Boolean);

  const depthDelta = pathSegments.length - hrefSegments.length;

  return depthDelta <= 1;
}
