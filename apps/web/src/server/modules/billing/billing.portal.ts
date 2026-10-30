import { TRPCError } from "@trpc/server";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE } from "@/shared/config/locales";

import type { DbClient } from "@/server/core/db";

import { PORTAL_RETURN_PATHS, STRIPE_PROVIDER } from "./billing.constants";
import { getStripeClient } from "./billing.stripe";

export type PortalReturnPath = (typeof PORTAL_RETURN_PATHS)[number];

export function portalReturnUrl(path: PortalReturnPath): string {
  return `${APP_URL.replace(/\/+$/, "")}/${DEFAULT_LOCALE}${path}`;
}

// Only our own pages are valid return targets, and the caller never supplies an absolute URL.
function assertAllowedReturnUrl(returnUrl: string): void {
  const allowed = PORTAL_RETURN_PATHS.map((path) => portalReturnUrl(path));

  if (!allowed.includes(returnUrl)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_RETURN_URL" });
  }
}

export type PortalSessionInput = {
  db: DbClient;
  returnUrl: string;
  workspaceId: string;
};

export type PortalSessionResult = {
  url: string;
};

export async function createPortalSession(input: PortalSessionInput): Promise<PortalSessionResult> {
  // The customer comes from our workspace mapping, never from the request body.
  const customer = await input.db.billingCustomer.findFirst({
    select: { externalCustomerId: true },
    where: { provider: STRIPE_PROVIDER, workspaceId: input.workspaceId },
  });

  if (customer == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "BILLING_CUSTOMER_NOT_FOUND" });
  }

  assertAllowedReturnUrl(input.returnUrl);

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customer.externalCustomerId,
    return_url: input.returnUrl,
  });

  // Returned once to the caller; never logged and never persisted.
  return { url: session.url };
}
