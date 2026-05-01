import { resolveMx } from "node:dns/promises";
import disposableDomains from "disposable-email-domains";
import validator from "validator";

export function normalizeEmail(email: string): string {
  const normalized = validator.normalizeEmail(email, {
    gmail_remove_dots: false, // NOTE: для совместимости с google oAuth
  });

  return typeof normalized === "string" ? normalized : email.toLowerCase().trim();
}

export async function validateEmailSafety(
  email: string
): Promise<{ reason?: string; safe: boolean }> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain == null) return { reason: "invalid_format", safe: false };

  if (disposableDomains.includes(domain)) {
    return { reason: "disposable", safe: false };
  }

  try {
    const mxPromise = resolveMx(domain);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 5000)
    );

    const mx = await Promise.race([mxPromise, timeout]);
    if (mx.length === 0) return { reason: "no_mx_records", safe: false };
  } catch {
    return { reason: "invalid_domain", safe: false };
  }

  return { safe: true };
}
