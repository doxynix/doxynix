import { clsx, type ClassValue } from "clsx";
import { format, type Locale as DateFnsLocale } from "date-fns";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { de, enUS, es, fr, ptBR, ru, zhCN } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

import { IS_PROD } from "../constants/env.client";
import { DEFAULT_LOCALE, type Locale } from "../constants/locales";

const dateFnsLocales: Record<Locale, DateFnsLocale> = {
  de: de,
  en: enUS,
  es: es,
  fr: fr,
  "pt-BR": ptBR,
  ru: ru,
  "zh-CN": zhCN,
};

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

    if (isNaN(d.getTime())) return defaultValue;

    const locale = dateFnsLocales[localeStr as Locale] ?? enUS;

    const result = formatDistanceToNow(d, {
      addSuffix: true,
      locale: locale,
    });

    return result.toLowerCase();
  } catch (error) {
    console.error("Date formatting error:", error);
    return defaultValue;
  }
}

export function formatFullDate(
  date: Date | string | number,
  localeStr: string = DEFAULT_LOCALE
): string {
  const locale = dateFnsLocales[localeStr as keyof typeof dateFnsLocales] ?? enUS;

  return format(new Date(date), "d MMMM yyyy, HH:mm", { locale: locale });
}

export function isGitHubUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  if (!/^https?:\/\//i.test(trimmed) && trimmed.includes("/")) {
    try {
      const normalized = `https://github.com/${trimmed.replace(/^\/+/, "")}`;
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === "github.com" || hostname.endsWith(".github.com");
    } catch {
      return false;
    }
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "github.com" || hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

const SENSITIVE_FIELDS = new Set([
  "password",
  "newPassword",
  "passwordHash",
  "hash",
  "salt",
  "token",
  "sessionToken",
  "verificationToken",
  "identifier",
  "access_token",
  "refresh_token",
  "id_token",
  "hashedKey",
  "secret",
  "clientSecret",
  "cvv",
  "creditCard",
  "iban",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sanitizePayload = (obj: any): any => {
  if (obj == null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (SENSITIVE_FIELDS.has(key)) {
        newObj[key] = "***REDACTED***";
      } else {
        newObj[key] = sanitizePayload(obj[key]);
      }
    }
  }
  return newObj;
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
    if (startTime == null) startTime = currentTime;
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
  if (name != null) {
    const parts = name.trim().split(" ").filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    if (parts.length === 1) {
      return parts[0].substring(0, 1).toUpperCase();
    }
  }

  if (email != null) {
    return email.substring(0, 1).toUpperCase();
  }

  return "U";
}
