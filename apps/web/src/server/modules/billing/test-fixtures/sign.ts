import { createHmac } from "node:crypto";

import { STRIPE_WEBHOOK_SECRET } from "@/shared/config/env.server";

// Test-only signature helper. The secret is the test placeholder from `setup-env.ts`; no live
// secret is ever stored in the repository.
export function signStripePayload(
  payload: string,
  options: { secret?: string; timestamp?: number } = {},
): string {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options.secret ?? STRIPE_WEBHOOK_SECRET;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

  return `t=${timestamp},v1=${signature}`;
}
