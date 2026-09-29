import { getSensitiveFieldNames } from "../core/field-encryption/config";
import { safeJsonClone } from "./safe-json";

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

const BEARER_TOKEN_REGEX = /(bearer\s+)[^\s,;]+/gi;

const MAX_STRING_LENGTH = 1024;

function redactPatterns(value: string): string {
  let safe = value;
  if (safe.includes("gh") || safe.includes("github_pat_")) {
    safe = safe.replaceAll(GITHUB_TOKEN_REGEX, "[REDACTED_GH_TOKEN]");
  }
  return safe.replaceAll(BEARER_TOKEN_REGEX, "$1[REDACTED]");
}

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
    const safe = redactPatterns(value);
    if (safe.length <= MAX_STRING_LENGTH) {
      return safe;
    }
    return `${safe.slice(0, MAX_STRING_LENGTH)}... [TRUNCATED, ORIGINAL LENGTH: ${value.length}]`;
  }

  return value;
}

export function sanitizePayload(obj: unknown): unknown {
  if (typeof obj === "string") {
    return redactValue("", obj);
  }
  if (typeof obj === "bigint") {
    return obj.toString();
  }
  if (obj == null || typeof obj !== "object") {
    return obj;
  }

  try {
    return safeJsonClone(obj, redactValue);
  } catch (error) {
    return {
      _sanitization_error: true,
      error_name: error instanceof Error ? error.name : "UnknownError",
      reason: "Sanitization failed",
      type_was: typeof obj,
    };
  }
}

/**
 * Technical Prisma keys that must never be persisted in an audit-log payload.
 * Shared with the audit-log mapper, which skips them when building the detail rows.
 */
export const SKIP_FIELDS = new Set([
  "analysisId",
  "githubId",
  "id",
  "include",
  "jobId",
  "nodeId",
  "prAnalysisId",
  "repoId",
  "select",
  "userId",
]);

function auditReplacer(key: string, value: unknown): unknown {
  if (SKIP_FIELDS.has(key)) {
    return undefined;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

export function sanitizeObject(obj: unknown): Record<string, unknown> {
  if (obj == null || typeof obj !== "object") {
    return {};
  }

  try {
    const sanitized = safeJsonClone(obj, auditReplacer);

    return sanitized != null && typeof sanitized === "object"
      ? (sanitized as Record<string, unknown>)
      : {};
  } catch {
    return { _error: "Sanitization failed" };
  }
}

const mask = (val: unknown) => (typeof val === "string" ? "[ENCRYPTED_MASKED]" : val);

export function maskSensitiveFields(modelName: string, data: unknown): unknown {
  if (data == null || typeof data !== "object") {
    return data;
  }
  const sensitiveFields = getSensitiveFieldNames(modelName);
  if (sensitiveFields.size === 0) {
    return data;
  }

  const cloned = Array.isArray(data) ? [...data] : { ...(data as Record<string, unknown>) };

  const traverse = (obj: unknown) => {
    if (obj == null || typeof obj !== "object") {
      return;
    }

    const record = obj as Record<string, unknown>;
    const nested = record.data;

    if (nested != null && typeof nested === "object") {
      // `typeof` narrows to `object`, which has no string index signature.
      const payload = nested as Record<string, unknown>;

      for (const key of Object.keys(payload)) {
        if (sensitiveFields.has(key)) {
          payload[key] = mask(payload[key]);
        } else if (typeof payload[key] === "object") {
          traverse(payload[key]);
        }
      }
    }

    for (const key of Object.keys(record)) {
      if (sensitiveFields.has(key)) {
        record[key] = mask(record[key]);
      } else if (typeof record[key] === "object") {
        traverse(record[key]);
      }
    }
  };

  traverse(cloned);
  return cloned;
}
