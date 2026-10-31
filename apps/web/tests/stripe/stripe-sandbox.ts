import Stripe from "stripe";

import { STRIPE_API_KEY, STRIPE_PRICE_PRO_MONTHLY_USD } from "@/shared/config/env.server";

import { STRIPE_API_VERSION } from "@/server/modules/billing/billing.constants";

// The suite is opt-in: no key, a live key, or no catalog price means every scenario is reported as
// `cannot-verify` instead of failing the run.
export function sandboxSkipReason(): null | string {
  if (STRIPE_API_KEY.trim() === "") {
    return "STRIPE_API_KEY is not configured";
  }

  if (STRIPE_API_KEY.startsWith("sk_live_") || STRIPE_API_KEY.startsWith("rk_live_")) {
    return "refusing to run sandbox scenarios against a live key";
  }

  // `setup-env.ts` fills placeholders so unit tests can import modules; they are not credentials.
  if (
    STRIPE_API_KEY.includes("placeholder") ||
    STRIPE_PRICE_PRO_MONTHLY_USD.includes("placeholder")
  ) {
    return "placeholder credentials, not a sandbox key";
  }

  if (STRIPE_PRICE_PRO_MONTHLY_USD.trim() === "") {
    return "STRIPE_PRICE_PRO_MONTHLY_USD is not configured";
  }

  return null;
}

export const SANDBOX_SKIP_REASON = sandboxSkipReason();
export const HAS_SANDBOX_CREDENTIALS = SANDBOX_SKIP_REASON == null;

let client: null | Stripe = null;

export function sandboxStripe(): Stripe {
  client ??= new Stripe(STRIPE_API_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });

  return client;
}

export function sandboxPriceId(): string {
  return STRIPE_PRICE_PRO_MONTHLY_USD;
}
