import safeStringify from "fast-safe-stringify";

import { ENCRYPTED_METADATA_MAP } from "./constants";

const SENSITIVE_KEYS = new Set([
  "access_token",
  "apikey",
  "authorization",
  "cardnumber",
  "clientsecret",
  "cookie",
  "creditcard",
  "cvv",
  "cvv2",
  "gh_token",
  "hash",
  "hashedkey",
  "iban",
  "id_token",
  "identifier",
  "imagekey",
  "newpassword",
  "passphrase",
  "password",
  "passwordhash",
  "privatekey",
  "proxy-authorization",
  "refresh_token",
  "salt",
  "secret",
  "session_id",
  "session_state",
  "sessiontoken",
  "set-cookie",
  "sid",
  "signingkey",
  "state",
  "token",
  "verificationtoken",
  "x-github-token",
]);

const GITHUB_TOKEN_REGEX = /(github_pat_\w+|gh[oprsu]_\w{36,})/g;
const BEARER_TOKEN_REGEX = /(\bbearer\s+)[^\s,;]+/gi;

function redactValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();
  const normalizedKey = lowerKey.replaceAll(/[_-]/g, "");

  if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(normalizedKey)) {
    return "[REDACTED]";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    if (value.length > 8192) {
      return value.slice(0, 1024) + `... [TRUNCATED, ORIGINAL LENGTH: ${value.length}]`;
    }

    let safeString = value;
    if (safeString.includes("gh") || safeString.includes("github_pat_")) {
      safeString = safeString.replaceAll(GITHUB_TOKEN_REGEX, "[REDACTED_GH_TOKEN]");
    }
    if (/bearer\s+/i.test(safeString)) {
      safeString = safeString.replaceAll(BEARER_TOKEN_REGEX, "$1[REDACTED]");
    }
    return safeString;
  }

  return value;
}

/**
 * Очищает переданный объект от секретов и технических полей перед логированием.
 * Безопасно обрабатывает циклические ссылки и BigInt.
 *
 * @param obj Данные для очистки
 */
export function sanitizePayload(obj: unknown): unknown {
  if (typeof obj === "string") return redactValue("", obj);
  if (typeof obj === "bigint") return obj.toString();
  if (obj == null || typeof obj !== "object") return obj;

  try {
    return JSON.parse(safeStringify(obj, redactValue));
  } catch (error) {
    return {
      _sanitization_error: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      reason: "Sanitization failed",
      type_was: typeof obj,
    };
  }
}

const mask = (val: unknown) => (typeof val === "string" ? "[ENCRYPTED_MASKED]" : val);

/**
 * Рекурсивно маскирует PII-данные на основе карты ENCRYPTED_METADATA_MAP,
 * чтобы предотвратить утечку шифруемых полей в сырой payload логов аудита.
 */
export function maskSensitiveFields(modelName: string, data: unknown): unknown {
  if (data == null || typeof data !== "object") return data;
  const sensitiveFields = ENCRYPTED_METADATA_MAP[modelName];
  if (!sensitiveFields) return data;

  const cloned = Array.isArray(data) ? [...data] : { ...(data as Record<string, unknown>) };

  const traverse = (obj: any) => {
    if (obj == null || typeof obj !== "object") return;

    if (obj.data != null && typeof obj.data === "object") {
      for (const key of Object.keys(obj.data)) {
        if (sensitiveFields[key] !== undefined) {
          obj.data[key] = mask(obj.data[key]);
        } else if (typeof obj.data[key] === "object") {
          traverse(obj.data[key]);
        }
      }
    }

    for (const key of Object.keys(obj)) {
      if (sensitiveFields[key] !== undefined) {
        obj[key] = mask(obj[key]);
      } else if (typeof obj[key] === "object") {
        traverse(obj[key]);
      }
    }
  };

  traverse(cloned);
  return cloned;
}
