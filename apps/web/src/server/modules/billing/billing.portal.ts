import { MessageCode } from "@doxynix/shared";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE } from "@/shared/config/locales";

import { AppError } from "@/server/core/api-error";
import { billingIdempotencyKey } from "@/server/core/billing/idempotency";
import { getStripeClient, providerEnvironment } from "@/server/core/billing/stripe-client";
import type { DbClient } from "@/server/core/db";

import { PORTAL_RETURN_PATHS, STRIPE_PROVIDER } from "./billing.constants";

export type PortalReturnPath = (typeof PORTAL_RETURN_PATHS)[number];

export function portalReturnUrl(path: PortalReturnPath): string {
  return `${APP_URL.replace(/\/+$/, "")}/${DEFAULT_LOCALE}${path}`;
}

// Only our own pages are valid return targets, and the caller never supplies an absolute URL.
function assertAllowedReturnUrl(returnUrl: string): void {
  const allowed = PORTAL_RETURN_PATHS.map((path) => portalReturnUrl(path));

  if (!allowed.includes(returnUrl)) {
    throw new AppError({
      code: "BAD_REQUEST",
      messageCode: MessageCode.INVALID_RETURN_URL,
      publicMessage: "INVALID_RETURN_URL",
    });
  }
}

export type PortalSessionInput = {
  db: DbClient;
  requestId: string;
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
    throw new AppError({
      code: "FORBIDDEN",
      messageCode: MessageCode.BILLING_CUSTOMER_NOT_FOUND,
      publicMessage: "BILLING_CUSTOMER_NOT_FOUND",
    });
  }

  assertAllowedReturnUrl(input.returnUrl);

  const stripe = getStripeClient();

  // The Portal must stay a payment-method/invoice surface: an enabled plan switch would bypass
  // the catalog, proration and seat checks that only Checkout performs.
  // Check the configuration the session will actually use, not just the first one in the list.
  // An inactive configuration cannot open a session, so it is never a candidate.
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const usable = configurations.data.filter((item) => item.active);
  const configuration = usable.find((item) => item.is_default) ?? usable[0];

  if (configuration == null) {
    throw new AppError({
      code: "PRECONDITION_FAILED",
      messageCode: MessageCode.PORTAL_NOT_CONFIGURED,
      publicMessage: "PORTAL_NOT_CONFIGURED",
    });
  }

  if (configuration.features.subscription_update.enabled) {
    throw new AppError({
      code: "PRECONDITION_FAILED",
      messageCode: MessageCode.PORTAL_ALLOWS_PLAN_CHANGE,
      publicMessage: "PORTAL_ALLOWS_PLAN_CHANGE",
    });
  }

  const session = await stripe.billingPortal.sessions.create(
    {
      configuration: configuration.id,
      customer: customer.externalCustomerId,
      return_url: input.returnUrl,
    },
    {
      idempotencyKey: billingIdempotencyKey({
        environment: providerEnvironment(),
        operation: "portal",
        requestId: input.requestId,
        workspaceId: input.workspaceId,
      }),
    },
  );

  // Returned once to the caller; never logged and never persisted.
  return { url: session.url };
}
