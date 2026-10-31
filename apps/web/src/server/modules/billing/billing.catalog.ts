import type { PlanCode } from "@doxynix/shared";

import { STRIPE_PRICE_PRO_MONTHLY_USD } from "@/shared/config/env.server";

export const PRO_PLAN_CODE = "PRO" as const;

export type BillingPlan = {
  code: typeof PRO_PLAN_CODE;
  currency: "usd";
  interval: "month";
  priceId: string;
};

// The shape this catalog needs from a Stripe Price; keeping it structural lets callers pass a
// Price object without the catalog depending on the SDK.
export type PriceIdentity = {
  currency: string;
  id: string;
  interval: null | string;
};

// Section 18 of the plan: product policy, not billing state. Stripe knows the price and the seat
// quantity; these values are written into the entitlement projection and read from the DB only.
export type PlanEntitlements = {
  aiTokensPerMonth: null | number;
  analysesPerMonth: null | number;
  autoResync: boolean;
  historyDays: null | number;
  privateReposAllowed: boolean;
  prReviews: boolean;
  reposLimit: null | number;
};

const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
  HOBBY: {
    aiTokensPerMonth: 1_000_000,
    analysesPerMonth: 20,
    autoResync: false,
    historyDays: 7,
    privateReposAllowed: false,
    prReviews: false,
    reposLimit: null,
  },
  PRO: {
    aiTokensPerMonth: 20_000_000,
    analysesPerMonth: 500,
    autoResync: true,
    historyDays: 90,
    privateReposAllowed: true,
    prReviews: true,
    reposLimit: null,
  },
  TEAM: {
    aiTokensPerMonth: null,
    analysesPerMonth: null,
    autoResync: true,
    historyDays: null,
    privateReposAllowed: true,
    prReviews: true,
    reposLimit: null,
  },
};

export function planEntitlements(planCode: PlanCode): PlanEntitlements {
  return PLAN_ENTITLEMENTS[planCode];
}

export type BillingCatalogErrorCode =
  | "UNKNOWN_PRICE"
  | "UNSUPPORTED_CURRENCY"
  | "UNSUPPORTED_INTERVAL";

export class BillingCatalogError extends Error {
  readonly code: BillingCatalogErrorCode;

  constructor(code: BillingCatalogErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BillingCatalogError";
  }
}

// One paid plan at launch. Stripe owns the amount and the Product; this file only maps a Price to
// a plan, so an unknown Price fails loudly instead of silently billing the wrong thing.
export function proPlan(): BillingPlan {
  const priceId = STRIPE_PRICE_PRO_MONTHLY_USD.trim();

  if (priceId === "") {
    throw new BillingCatalogError(
      "UNKNOWN_PRICE",
      "STRIPE_PRICE_PRO_MONTHLY_USD is not configured",
    );
  }

  return { code: PRO_PLAN_CODE, currency: "usd", interval: "month", priceId };
}

export function resolvePlanForPrice(price: PriceIdentity): BillingPlan {
  const plan = proPlan();

  if (price.id !== plan.priceId) {
    throw new BillingCatalogError("UNKNOWN_PRICE", `Unknown price: ${price.id}`);
  }

  if (price.currency.toLowerCase() !== plan.currency) {
    throw new BillingCatalogError(
      "UNSUPPORTED_CURRENCY",
      `Unsupported currency: ${price.currency}`,
    );
  }

  if (price.interval !== plan.interval) {
    throw new BillingCatalogError(
      "UNSUPPORTED_INTERVAL",
      `Unsupported interval: ${String(price.interval)}`,
    );
  }

  return plan;
}
