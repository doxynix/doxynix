import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // A paid launch without required tax jurisdictions is a configuration mistake, not a code
    // bug: warn at startup and let the nightly preflight raise the critical issue.
    const { IS_PROD } = await import("@/shared/config/env.flags");
    const { STRIPE_TAX_REQUIRED_JURISDICTIONS } = await import("@/shared/config/env.server");

    if (IS_PROD && STRIPE_TAX_REQUIRED_JURISDICTIONS.length === 0) {
      const { appLogger } = await import("@/server/core/app-logger");
      appLogger.warn({ msg: "billing_tax_jurisdictions_not_configured" });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
