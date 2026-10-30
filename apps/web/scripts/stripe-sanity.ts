/**
 * Preflight for billing work: proves the Doppler config is a Stripe sandbox and that the PRO price
 * has the shape the catalog expects. Prints no ids, keys or amounts.
 *
 * Usage: bun with-doppler "bun scripts/stripe-sanity.ts"
 */
import Stripe from "stripe";

import { STRIPE_API_VERSION } from "../src/server/modules/billing/billing.constants";

function fail(message: string): never {
  console.error(`stripe-sanity: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const apiKey = process.env.STRIPE_API_KEY ?? "";
  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY_USD ?? "";

  if (!apiKey.startsWith("sk_test_") && !apiKey.startsWith("rk_test_")) {
    fail("STRIPE_API_KEY is not a sandbox key (expected sk_test_ or rk_test_)");
  }

  if (process.env.STRIPE_LIVEMODE === "true") {
    fail("STRIPE_LIVEMODE must be false for sandbox work");
  }

  if (priceId === "") {
    fail("STRIPE_PRICE_PRO_MONTHLY_USD is not set");
  }

  const stripe = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION, typescript: true });

  const balance = await stripe.balance.retrieve();
  console.log(`stripe-sanity: balance ok (${balance.available.length} currencies)`);

  const price = await stripe.prices.retrieve(priceId);

  if (!price.active) {
    fail("PRO price is not active");
  }

  if (price.type !== "recurring") {
    fail("PRO price is not recurring");
  }

  if (price.currency !== "usd") {
    fail("PRO price currency is not usd");
  }

  if (price.recurring?.interval !== "month") {
    fail("PRO price interval is not month");
  }

  console.log("stripe-sanity: price ok (active, usd, month)");
}

if (import.meta.main) {
  await main();
}
