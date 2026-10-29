import { describe, expect, it } from "vitest";

import {
  BillingCatalogError,
  type BillingCatalogErrorCode,
  PRO_PLAN_CODE,
  proPlan,
  resolvePlanForPrice,
} from "./billing.catalog";

function rejectionCode(run: () => unknown): BillingCatalogErrorCode | "NO_ERROR" {
  try {
    run();
  } catch (error) {
    return error instanceof BillingCatalogError ? error.code : "NO_ERROR";
  }

  return "NO_ERROR";
}

describe("billing catalog", () => {
  it("exposes one PRO plan in USD billed monthly at the configured price", () => {
    const plan = proPlan();

    expect(plan.code).toBe(PRO_PLAN_CODE);
    expect(plan.currency).toBe("usd");
    expect(plan.interval).toBe("month");
    expect(plan.priceId).toMatch(/^price_/);
  });

  it("accepts the Price that matches the configured plan", () => {
    const plan = proPlan();

    const resolved = resolvePlanForPrice({
      currency: plan.currency,
      id: plan.priceId,
      interval: plan.interval,
    });

    expect(resolved).toEqual(plan);
  });

  it("rejects an unknown Price instead of falling back to a default", () => {
    const plan = proPlan();

    const code = rejectionCode(() =>
      resolvePlanForPrice({
        currency: plan.currency,
        id: "price_unknown",
        interval: plan.interval,
      }),
    );

    expect(code).toBe("UNKNOWN_PRICE");
  });

  it("rejects a non-monthly interval", () => {
    const plan = proPlan();

    const code = rejectionCode(() =>
      resolvePlanForPrice({ currency: plan.currency, id: plan.priceId, interval: "year" }),
    );

    expect(code).toBe("UNSUPPORTED_INTERVAL");
  });

  it("rejects a non-USD currency", () => {
    const plan = proPlan();

    const code = rejectionCode(() =>
      resolvePlanForPrice({ currency: "eur", id: plan.priceId, interval: plan.interval }),
    );

    expect(code).toBe("UNSUPPORTED_CURRENCY");
  });

  it("rejects a Price without a recurring interval", () => {
    const plan = proPlan();

    const code = rejectionCode(() =>
      resolvePlanForPrice({ currency: plan.currency, id: plan.priceId, interval: null }),
    );

    expect(code).toBe("UNSUPPORTED_INTERVAL");
  });
});
