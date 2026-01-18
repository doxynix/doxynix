import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const loadedAvatars = new Map<string, boolean>();

export function formatRelativeTime(
  date: Date | string | number | null,
  defaultValue: string = "—"
): string {
  if (date === null) return defaultValue;

  try {
    const d = new Date(date);

    if (isNaN(d.getTime())) return defaultValue;

    const result = formatDistanceToNow(d, {
      addSuffix: true,
      locale: ru,
    });

    return result.toLowerCase();
  } catch (error) {
    console.error("Date formatting error:", error);
    return defaultValue;
  }
}

export function formatFullDate(date: Date | string | number): string {
  return format(new Date(date), "d MMMM yyyy, HH:mm", { locale: ru });
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
  if (obj === null || typeof obj !== "object") return obj;

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
