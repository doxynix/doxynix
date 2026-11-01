import { readFileSync } from "node:fs";

import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APP_URL } from "@/shared/config/env.client";
import { DEFAULT_LOCALE } from "@/shared/config/locales";

import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { createPortalSession, portalReturnUrl } from "./billing.portal";
import { fromStripeSubscription } from "./billing.snapshot";
import { projectSubscription } from "./billing.subscriptions";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-30T12:00:00.000Z");

const stripeMock = vi.hoisted(() => ({
  billingPortal: {
    configurations: { list: vi.fn() },
    sessions: { create: vi.fn() },
  },
}));

vi.mock("@/server/core/billing/stripe-client", () => ({
  getStripeClient: () => stripeMock,
  providerEnvironment: () => "test",
}));

function createDb(customer: null | { externalCustomerId: string }) {
  return {
    billingCustomer: { findFirst: vi.fn().mockResolvedValue(customer) },
  } as unknown as DbClient;
}

describe("createPortalSession", () => {
  beforeEach(() => {
    stripeMock.billingPortal.sessions.create.mockReset().mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test",
    });
    stripeMock.billingPortal.configurations.list.mockReset().mockResolvedValue({
      data: [
        {
          active: true,
          features: { subscription_update: { enabled: false } },
          id: "bpc_default",
          is_default: true,
        },
      ],
    });
  });

  it("creates a session for the workspace customer and returns only the url", async () => {
    const db = createDb({ externalCustomerId: "cus_workspace" });
    const returnUrl = portalReturnUrl("/dashboard/settings/members");

    const result = await createPortalSession({
      db,
      requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
      returnUrl,
      workspaceId: WORKSPACE_ID,
    });

    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      {
        configuration: "bpc_default",
        customer: "cus_workspace",
        return_url: `${APP_URL.replace(/\/+$/, "")}/${DEFAULT_LOCALE}/dashboard/settings/members`,
      },
      { idempotencyKey: expect.stringContaining(":portal:") },
    );
    expect(result).toEqual({ url: "https://billing.stripe.com/p/session/test" });
    expect(Object.keys(result)).toEqual(["url"]);
  });

  it("refuses a workspace without a customer mapping", async () => {
    const db = createDb(null);

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: portalReturnUrl("/dashboard/settings/members"),
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "BILLING_CUSTOMER_NOT_FOUND" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("refuses a portal that would bypass checkout plan changes", async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({
      data: [
        {
          active: true,
          features: { subscription_update: { enabled: true } },
          id: "bpc_default",
          is_default: true,
        },
      ],
    });
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: portalReturnUrl("/dashboard/settings/members"),
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "PORTAL_ALLOWS_PLAN_CHANGE" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("checks the default configuration even when another one is listed first", async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({
      data: [
        {
          features: { subscription_update: { enabled: false } },
          id: "bpc_other",
          is_default: false,
        },
        {
          active: true,
          features: { subscription_update: { enabled: true } },
          id: "bpc_default",
          is_default: true,
        },
      ],
    });
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: portalReturnUrl("/dashboard/settings/members"),
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "PORTAL_ALLOWS_PLAN_CHANGE" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("refuses to open a portal when every configuration is inactive", async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({
      data: [
        {
          active: false,
          features: { subscription_update: { enabled: false } },
          id: "bpc_default",
          is_default: true,
        },
      ],
    });
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: portalReturnUrl("/dashboard/settings/members"),
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "PORTAL_NOT_CONFIGURED" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("skips an inactive default in favour of an active configuration", async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({
      data: [
        {
          active: false,
          features: { subscription_update: { enabled: false } },
          id: "bpc_off",
          is_default: true,
        },
        {
          active: true,
          features: { subscription_update: { enabled: false } },
          id: "bpc_on",
          is_default: false,
        },
      ],
    });
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await createPortalSession({
      db,
      requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
      returnUrl: portalReturnUrl("/dashboard/settings/members"),
      workspaceId: WORKSPACE_ID,
    });

    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: "bpc_on" }),
      expect.anything(),
    );
  });

  it("refuses to open a portal when Stripe has no configuration", async () => {
    stripeMock.billingPortal.configurations.list.mockResolvedValue({ data: [] });
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: portalReturnUrl("/dashboard/settings/members"),
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "PORTAL_NOT_CONFIGURED" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("refuses a return url outside the allowlist", async () => {
    const db = createDb({ externalCustomerId: "cus_workspace" });

    await expect(
      createPortalSession({
        db,
        requestId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e",
        returnUrl: "https://evil.example.com/steal",
        workspaceId: WORKSPACE_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "INVALID_RETURN_URL" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("never logs or persists the portal url", () => {
    const source = readFileSync(join(import.meta.dirname, "billing.portal.ts"), "utf8");

    expect(source).not.toContain("appLogger");
    expect(source).not.toContain("billingOperation");
    expect(source).not.toContain("billingLedgerEntry");
    expect(source).not.toContain("console.");
  });

  it("is exposed only through ownerProcedure", () => {
    const source = readFileSync(join(import.meta.dirname, "billing.router.ts"), "utf8");

    expect(source).toContain("createPortalSession: ownerProcedure");
  });
});

describe("cancel at period end", () => {
  function subscription(overrides: Record<string, unknown> = {}) {
    return {
      cancel_at: null,
      cancel_at_period_end: true,
      customer: "cus_1",
      id: "sub_1",
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            current_period_start: 1_790_000_000,
            id: "si_1",
            price: { currency: "usd", id: proPlan().priceId, recurring: { interval: "month" } },
            quantity: 2,
          },
        ],
      },
      latest_invoice: "in_1",
      status: "active",
      ...overrides,
    };
  }

  function createTx() {
    return {
      billingIssue: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      billingSubscription: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          activatedAt: NOW,
          externalStatus: "active",
          graceEndsAt: null,
          id: "bs_1",
          isCurrent: true,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({ id: "bs_1" }),
      },
      workspaceEntitlement: {
        findUnique: vi.fn().mockResolvedValue({
          accessState: "ACTIVE",
          sourceSubscriptionId: "bs_1",
        }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      workspaceMember: { count: vi.fn().mockResolvedValue(1) },
    };
  }

  it("keeps access until the subscription is actually canceled", async () => {
    const tx = createTx();

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: { billingCustomerId: "bc_1", customerId: "cus_1", workspaceId: WORKSPACE_ID },
      snapshot: fromStripeSubscription(subscription() as never),
    });

    const entitlement = tx.workspaceEntitlement.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };

    expect(entitlement.update.accessState).toBe("ACTIVE");
    expect(entitlement.update.seatLimit).toBe(2);
  });

  it("revokes access when Stripe reports the subscription canceled", async () => {
    const tx = createTx();

    await projectSubscription(tx as unknown as DbClient, {
      now: NOW,
      ownership: { billingCustomerId: "bc_1", customerId: "cus_1", workspaceId: WORKSPACE_ID },
      snapshot: fromStripeSubscription(
        subscription({ cancel_at_period_end: false, status: "canceled" }) as never,
      ),
    });

    const entitlement = tx.workspaceEntitlement.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };

    expect(entitlement.update.accessState).toBe("CANCELED");
  });
});
