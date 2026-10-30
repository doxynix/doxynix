import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";

import { APP_URL } from "@/shared/config/env.client";
import { STRIPE_LIVEMODE } from "@/shared/config/env.server";
import { DEFAULT_LOCALE } from "@/shared/config/locales";

import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { STRIPE_PROVIDER } from "./billing.constants";
import { runBillingOperation, stripeIdempotencyKey } from "./billing.operations";
import type { CreateCheckoutResult } from "./billing.schemas";
import { getStripeClient } from "./billing.stripe";

const CHECKOUT_RETURN_PATH = "/dashboard/settings/members";

export type CreateCheckoutInput = {
  actorUserId: string;
  db: DbClient;
  requestId: string;
  workspaceId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripeEnvironment(): "live" | "test" {
  return STRIPE_LIVEMODE ? "live" : "test";
}

function checkoutUrls(): { cancelUrl: string; successUrl: string } {
  const base = `${APP_URL.replace(/\/+$/, "")}/${DEFAULT_LOCALE}${CHECKOUT_RETURN_PATH}`;

  return {
    cancelUrl: `${base}?checkout=cancel`,
    successUrl: `${base}?checkout=success`,
  };
}

function checkoutResult(result: unknown): CreateCheckoutResult {
  if (isRecord(result) && typeof result.sessionId === "string") {
    return {
      sessionId: result.sessionId,
      // Stored results never carry the URL, so a replay is url-less by design.
      url: typeof result.url === "string" ? result.url : null,
    };
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "BILLING_CHECKOUT_RESULT_MISSING",
  });
}

// One Stripe Customer per workspace. Ownership lives in our DB, not in Stripe metadata. The Stripe
// call carries its own idempotency key, so retrying a failed checkout reuses the same customer.
async function ensureCustomer(input: CreateCheckoutInput): Promise<string> {
  const existing = await input.db.billingCustomer.findFirst({
    select: { externalCustomerId: true },
    where: { provider: STRIPE_PROVIDER, workspaceId: input.workspaceId },
  });

  if (existing != null) {
    return existing.externalCustomerId;
  }

  const customer = await getStripeClient().customers.create(
    {},
    {
      idempotencyKey: stripeIdempotencyKey({
        environment: stripeEnvironment(),
        operation: "customer",
        requestId: input.requestId,
        workspaceId: input.workspaceId,
      }),
    },
  );

  // Upsert rather than create: two different request ids can race here, and the loser's Stripe
  // customer is left for reconciliation to flag as unowned.
  const stored = await input.db.billingCustomer.upsert({
    create: {
      externalCustomerId: customer.id,
      livemode: customer.livemode,
      provider: STRIPE_PROVIDER,
      workspaceId: input.workspaceId,
    },
    select: { externalCustomerId: true },
    update: {},
    where: {
      workspaceId_provider: { provider: STRIPE_PROVIDER, workspaceId: input.workspaceId },
    },
  });

  return stored.externalCustomerId;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const plan = proPlan();
  const { cancelUrl, successUrl } = checkoutUrls();

  // Seats are the active membership count at creation time; owner-only is enforced by the router.
  const quantity = await input.db.workspaceMember.count({
    where: { workspaceId: input.workspaceId },
  });

  if (quantity < 1) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "NO_ACTIVE_MEMBERS" });
  }

  // Customer and Session are one client command, so they share one operation row: the ledger is
  // unique per (workspaceId, requestId).
  const run = await runBillingOperation(input.db, {
    actorUserId: input.actorUserId,
    execute: async () => {
      // Inside execute so a replayed operation still returns its session instead of failing.
      const current = await input.db.billingSubscription.findFirst({
        select: { id: true },
        where: { isCurrent: true, workspaceId: input.workspaceId },
      });

      if (current != null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ALREADY_SUBSCRIBED" });
      }

      const customerId = await ensureCustomer(input);

      const params: Stripe.Checkout.SessionCreateParams = {
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        cancel_url: cancelUrl,
        customer: customerId,
        customer_update: { address: "auto" },
        line_items: [{ price: plan.priceId, quantity }],
        mode: "subscription",
        // Pins proration/cancellation behaviour to classic regardless of the account default.
        subscription_data: { billing_mode: { type: "classic" } },
        success_url: successUrl,
        tax_id_collection: { enabled: true, required: "never" },
      };

      const session = await getStripeClient().checkout.sessions.create(params, {
        idempotencyKey: stripeIdempotencyKey({
          environment: stripeEnvironment(),
          operation: "checkout",
          requestId: input.requestId,
          workspaceId: input.workspaceId,
        }),
      });

      // The row is the Session↔Workspace link; Stripe metadata is not used for ownership.
      await input.db.billingCheckoutSession.create({
        data: {
          stripeCheckoutSessionId: session.id,
          stripeCustomerId: customerId,
          stripeStatus: session.status ?? null,
          workspaceId: input.workspaceId,
        },
      });

      return {
        result: { sessionId: session.id, url: session.url },
        stripeObjectId: session.id,
      };
    },
    operation: "CHECKOUT_CREATE",
    requestBody: {
      planCode: plan.code,
      priceId: plan.priceId,
      quantity,
      workspaceId: input.workspaceId,
    },
    requestId: input.requestId,
    workspaceId: input.workspaceId,
  });

  return checkoutResult(run.result);
}
