import "server-only";

import Stripe from "stripe";

import { STRIPE_API_KEY, STRIPE_LIVEMODE } from "@/shared/config/env.server";

import { STRIPE_API_VERSION } from "./billing.constants";

export { STRIPE_API_VERSION };

// Sandbox vs live is the meaningful environment for Stripe idempotency keys.
export function stripeEnvironment(): "live" | "test" {
  return STRIPE_LIVEMODE ? "live" : "test";
}

let stripeClient: null | Stripe = null;

// Lazy so importing this module (tests, type-check) never needs a key, and so one client is reused
// instead of leaking a new connection pool per call.
export function getStripeClient(): Stripe {
  if (stripeClient == null) {
    if (STRIPE_API_KEY.trim() === "") {
      throw new Error("STRIPE_API_KEY is not configured");
    }

    stripeClient = new Stripe(STRIPE_API_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }

  return stripeClient;
}
