import { handleStripeWebhook } from "@/server/modules/billing/billing.webhook";
import { withApiHandler } from "@/server/utils/with-api-handler";

export const runtime = "nodejs";

// Thin on purpose: verification, durability and enqueue live in the billing slice.
export const POST = withApiHandler(handleStripeWebhook, { scope: "stripe-webhook" });
