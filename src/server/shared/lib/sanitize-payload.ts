import "server-only";

import safeStringify from "fast-safe-stringify";

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
