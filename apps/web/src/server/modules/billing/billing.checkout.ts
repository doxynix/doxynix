import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";

import { APP_URL } from "@/shared/config/env.client";
import { IS_PROD } from "@/shared/config/env.flags";
import { DEFAULT_LOCALE } from "@/shared/config/locales";

import { stripeIdempotencyKey } from "@/server/core/billing/idempotency";
import { getStripeClient, stripeEnvironment } from "@/server/core/billing/stripe-client";
import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { STRIPE_PROVIDER } from "./billing.constants";
import { runBillingOperation } from "./billing.operations";
import type { CreateCheckoutResult } from "./billing.schemas";
import { requiredJurisdictions, runTaxPreflight } from "./billing.tax";

const CHECKOUT_RETURN_PATH = "/dashboard/settings/members";
// Stripe expires an open Checkout Session after 24 hours by default.
const CHECKOUT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// A placeholder older than this belongs to a crashed request, not to a live tab.
const PENDING_SESSION_TTL_MS = 10 * 60 * 1000;

export type CreateCheckoutInput = {
  actorUserId: string;
  db: DbClient;
  requestId: string;
  workspaceId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

      type Blocked = { id: string; kind: "open" | "paid" | "pending" };
      const pendingSessionId = `pending:${input.requestId}`;
      let blocked: Blocked | null = null;

      // Check and write inside one advisory-locked transaction: the row must exist before the
      // Stripe call, otherwise two concurrent requests with different requestIds both pass.
      if ("$transaction" in input.db) {
        blocked = await input.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${input.workspaceId}`}))`;

          const recent = await tx.billingCheckoutSession.findFirst({
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, externalCheckoutSessionId: true, externalStatus: true },
            where: {
              createdAt: { gte: new Date(Date.now() - CHECKOUT_SESSION_TTL_MS) },
              externalStatus: { in: ["complete", "open", "pending"] },
              workspaceId: input.workspaceId,
            },
          });

          if (recent != null) {
            const abandoned =
              recent.externalStatus === "pending" &&
              Date.now() - recent.createdAt.getTime() > PENDING_SESSION_TTL_MS;

            if (!abandoned) {
              return {
                id: recent.externalCheckoutSessionId,
                kind:
                  recent.externalStatus === "open"
                    ? "open"
                    : recent.externalStatus === "complete"
                      ? "paid"
                      : "pending",
              };
            }

            await tx.billingCheckoutSession.delete({
              where: { externalCheckoutSessionId: recent.externalCheckoutSessionId },
            });
          }

          await tx.billingCheckoutSession.create({
            data: {
              externalCheckoutSessionId: pendingSessionId,
              externalCustomerId: "",
              externalStatus: "pending",
              workspaceId: input.workspaceId,
            },
          });

          return null;
        });
      }

      if (blocked?.kind === "open") {
        const existing = await getStripeClient()
          .checkout.sessions.retrieve(blocked.id)
          .catch(() => null);

        if (existing?.status === "open" && existing.url != null) {
          return {
            externalObjectId: existing.id,
            result: { sessionId: existing.id, url: existing.url },
          };
        }
      }

      if (blocked != null) {
        // Paid-but-not-projected, a live request in another tab, or a cancel whose Session Stripe
        // still holds: none of these may open a second Subscription.
        throw new TRPCError({ code: "CONFLICT", message: "CHECKOUT_IN_PROGRESS" });
      }

      let session: Stripe.Checkout.Session;
      let customerId = "";

      try {
        // With required jurisdictions configured, a sale must not start while Stripe Tax lacks a
        // registration: `automatic_tax` would otherwise collect zero and look like success. In
        // production an empty list is itself a misconfiguration and blocks the sale.
        const required = requiredJurisdictions();

        if (required.length === 0) {
          if (IS_PROD) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TAX_NOT_CONFIGURED" });
          }
        } else {
          const preflight = await runTaxPreflight(input.db);

          if (!preflight.settingsActive || preflight.missingJurisdictions.length > 0) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "TAX_NOT_READY" });
          }
        }

        customerId = await ensureCustomer(input);

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

        session = await getStripeClient().checkout.sessions.create(params, {
          idempotencyKey: stripeIdempotencyKey({
            environment: stripeEnvironment(),
            operation: "checkout",
            requestId: input.requestId,
            workspaceId: input.workspaceId,
          }),
        });
      } catch (error) {
        // Never leave a placeholder behind: it would block the next attempt for its whole TTL.
        await input.db.billingCheckoutSession
          .deleteMany({ where: { externalCheckoutSessionId: pendingSessionId } })
          .catch(() => undefined);

        throw error;
      }

      // The row is the Session↔Workspace link; Stripe metadata is not used for ownership.
      await input.db.billingCheckoutSession.update({
        data: {
          externalCheckoutSessionId: session.id,
          externalCustomerId: customerId,
          externalStatus: session.status ?? null,
        },
        where: { externalCheckoutSessionId: pendingSessionId },
      });

      return {
        externalObjectId: session.id,
        result: { sessionId: session.id, url: session.url },
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
