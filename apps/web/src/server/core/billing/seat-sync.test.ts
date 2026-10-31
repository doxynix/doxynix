import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { syncWorkspaceSeats } from "./seat-sync";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

const stripeMock = vi.hoisted(() => ({ subscriptions: { update: vi.fn() } }));

vi.mock("./stripe-client", () => ({
  getStripeClient: () => stripeMock,
  stripeEnvironment: () => "test",
}));

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    quantity: 2,
    stripeStatus: "active",
    stripeSubscriptionId: "sub_1",
    stripeSubscriptionItemId: "si_1",
    ...overrides,
  };
}

function createDb(input: { members: number; subscription: null | Record<string, unknown> }) {
  return {
    billingSubscription: { findFirst: vi.fn().mockResolvedValue(input.subscription) },
    workspaceMember: { count: vi.fn().mockResolvedValue(input.members) },
  } as unknown as DbClient;
}

function dbClient(db: DbClient) {
  return db as unknown as {
    billingSubscription: { findFirst: ReturnType<typeof vi.fn> };
    workspaceMember: { count: ReturnType<typeof vi.fn> };
  };
}

describe("syncWorkspaceSeats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bills the extra seat immediately when the workspace grows", async () => {
    const db = createDb({ members: 3, subscription: subscription() });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 3, synced: true });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      {
        items: [{ id: "si_1", quantity: 3 }],
        proration_behavior: "always_invoice",
      },
      { idempotencyKey: `doxynix:test:seats:${WORKSPACE_ID}:${REQUEST_ID}` },
    );
  });

  it("prorates instead of invoicing when the workspace shrinks", async () => {
    const db = createDb({ members: 1, subscription: subscription({ quantity: 4 }) });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 1, synced: true });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      {
        items: [{ id: "si_1", quantity: 1 }],
        proration_behavior: "create_prorations",
      },
      expect.objectContaining({ idempotencyKey: expect.stringContaining(":seats:") }),
    );
  });

  it("never bills zero seats", async () => {
    const db = createDb({ members: 0, subscription: subscription({ quantity: 2 }) });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 1, synced: true });
  });

  it("skips Stripe entirely for a workspace without a subscription", async () => {
    const db = createDb({ members: 3, subscription: null });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 3, synced: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("does nothing when the paid quantity already matches the members", async () => {
    const db = createDb({ members: 2, subscription: subscription({ quantity: 2 }) });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 2, synced: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("leaves a past_due subscription to dunning", async () => {
    const db = createDb({ members: 4, subscription: subscription({ stripeStatus: "past_due" }) });

    const result = await syncWorkspaceSeats({
      db,
      requestId: REQUEST_ID,
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual({ quantity: 4, synced: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("counts members of the requested workspace only", async () => {
    const db = createDb({ members: 1, subscription: subscription({ quantity: 1 }) });

    await syncWorkspaceSeats({ db, requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(dbClient(db).workspaceMember.count).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
    });
    expect(dbClient(db).billingSubscription.findFirst).toHaveBeenCalledWith({
      select: expect.objectContaining({ stripeSubscriptionItemId: true }),
      where: { isCurrent: true, workspaceId: WORKSPACE_ID },
    });
  });
});
