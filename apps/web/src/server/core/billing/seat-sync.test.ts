import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncWorkspaceSeats } from "./seat-sync";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

const dbMock = vi.hoisted(() => ({
  billingSubscription: { findFirst: vi.fn() },
  workspaceMember: { count: vi.fn() },
}));

const stripeMock = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
}));

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("./stripe-client", () => ({
  getStripeClient: () => stripeMock,
  stripeEnvironment: () => "test",
}));

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    externalStatus: "active",
    externalSubscriptionId: "sub_1",
    externalSubscriptionItemId: "si_1",
    quantity: 2,
    ...overrides,
  };
}

function arrange(input: {
  members: number;
  remoteQuantity?: number;
  subscription: null | Record<string, unknown>;
}) {
  dbMock.workspaceMember.count.mockResolvedValue(input.members);
  dbMock.billingSubscription.findFirst.mockResolvedValue(input.subscription);
  stripeMock.subscriptions.retrieve.mockResolvedValue({
    items: { data: [{ quantity: input.remoteQuantity ?? 1 }] },
  });
}

describe("syncWorkspaceSeats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bills the extra seat immediately when the workspace grows", async () => {
    arrange({ members: 3, remoteQuantity: 2, subscription: subscription() });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

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
    arrange({ members: 1, remoteQuantity: 4, subscription: subscription({ quantity: 4 }) });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

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

  it("trusts Stripe, not the local mirror, when the webhook has not arrived yet", async () => {
    arrange({ members: 2, remoteQuantity: 1, subscription: subscription({ quantity: 1 }) });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(result).toEqual({ quantity: 2, synced: true });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({ items: [{ id: "si_1", quantity: 2 }] }),
      expect.anything(),
    );
  });

  it("never bills zero seats", async () => {
    arrange({ members: 0, remoteQuantity: 2, subscription: subscription({ quantity: 2 }) });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(result).toEqual({ quantity: 1, synced: true });
  });

  it("skips Stripe entirely for a workspace without a subscription", async () => {
    arrange({ members: 3, subscription: null });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(result).toEqual({ quantity: 3, synced: false });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("does nothing when the paid quantity already matches the members", async () => {
    arrange({ members: 2, remoteQuantity: 2, subscription: subscription({ quantity: 2 }) });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(result).toEqual({ quantity: 2, synced: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("leaves a past_due subscription to dunning", async () => {
    arrange({
      members: 4,
      subscription: subscription({ externalStatus: "past_due" }),
    });

    const result = await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(result).toEqual({ quantity: 4, synced: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("counts members of the requested workspace only", async () => {
    arrange({ members: 1, remoteQuantity: 1, subscription: subscription({ quantity: 1 }) });

    await syncWorkspaceSeats({ requestId: REQUEST_ID, workspaceId: WORKSPACE_ID });

    expect(dbMock.workspaceMember.count).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
    });
    expect(dbMock.billingSubscription.findFirst).toHaveBeenCalledWith({
      select: expect.objectContaining({ externalSubscriptionItemId: true }),
      where: { isCurrent: true, workspaceId: WORKSPACE_ID },
    });
  });
});
