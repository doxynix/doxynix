import crypto from "node:crypto";
import { resolveMx } from "node:dns/promises";
import disposableDomains from "disposable-email-domains";
import validator from "validator";

import { LOG_SALT_SECRET } from "@/shared/constants/env.server";

import { logger } from "../infrastructure/logger";

export function normalizeEmail(email: string): string {
  const normalized = validator.normalizeEmail(email, {
    gmail_remove_dots: false, // NOTE: для совместимости с google oAuth
  });

  return typeof normalized === "string" ? normalized : email.toLowerCase().trim();
}

export function maskEmail(email: null | string | undefined): string {
  if (email == null) {
    return "unknown@address";
  }

  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");

  const local = parts[0];
  const domain = parts[1];

  if (local == null || domain == null) {
    return "invalid-email";
  }

  const firstChar = local.charAt(0);

  const hash = crypto
    .createHmac("sha256", LOG_SALT_SECRET)
    .update(local)
    .digest("hex")
    .slice(0, 10);

  return `${firstChar}...${hash}@${domain}`;
}

interface NodeSystemError extends Error {
  code?: string;
}

const isPermanentDnsError = (err: unknown): err is NodeSystemError => {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof err.code === "string" &&
    ["ENODATA", "ENOTFOUND"].includes(err.code)
  );
};

const disposableDomainSet = new Set(disposableDomains);

export async function validateEmailSafety(
  email: string
): Promise<{ reason?: string; safe: boolean }> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain == null) return { reason: "invalid_format", safe: false };

  if (disposableDomainSet.has(domain)) {
    return { reason: "disposable", safe: false };
  }

  try {
    const mxPromise = resolveMx(domain);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS_TIMEOUT")), 5000)
    );

    const mx = await Promise.race([mxPromise, timeout]);
    if (mx.length === 0) return { reason: "no_mx_records", safe: false };
  } catch (error_) {
    if (isPermanentDnsError(error_)) {
      return { reason: "invalid_domain", safe: false };
    }
    const errorMessage = error_ instanceof Error ? error_.message : String(error_);
    logger.warn({ domain, error: errorMessage, msg: "DNS check bypassed due to temporary error" });
    return { safe: true };
  }

  return { safe: true };
}
