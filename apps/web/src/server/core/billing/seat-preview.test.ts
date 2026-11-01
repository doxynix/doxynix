import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { previewSeatAddition } from "./seat-preview";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const PERIOD_END = 1_800_000_000;

const dbMock = vi.hoisted(() => ({
  billingSubscription: { findFirst: vi.fn() },
  workspaceMember: { count: vi.fn() },
}));

const stripeMock = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn() },
}));

vi.mock("./stripe-client", () => ({
  getStripeClient: () => stripeMock,
  providerEnvironment: () => "test",
}));

function arrange(input: {
  amount?: null | number;
  members: number;
  quantity?: number;
  status?: string;
  subscription?: boolean;
}) {
  dbMock.workspaceMember.count.mockResolvedValue(input.members);
  dbMock.billingSubscription.findFirst.mockResolvedValue(
    input.subscription === false
      ? null
      : {
          externalStatus: input.status ?? "active",
          externalSubscriptionId: "sub_1",
          quantity: input.quantity ?? 1,
        },
  );
  stripeMock.subscriptions.retrieve.mockResolvedValue({
    items: {
      data: [
        {
          current_period_end: PERIOD_END,
          price: { currency: "usd", unit_amount: input.amount === undefined ? 2000 : input.amount },
        },
      ],
    },
  });
}

function preview() {
  return previewSeatAddition({
    db: dbMock as unknown as DbClient,
    workspaceId: WORKSPACE_ID,
  });
}

describe("previewSeatAddition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports the seat price when adding a member goes past the paid quantity", async () => {
    arrange({ members: 2, quantity: 2 });

    await expect(preview()).resolves.toEqual({
      amountPerSeatCents: 2000,
      currency: "usd",
      needsCharge: true,
      periodEnd: new Date(PERIOD_END * 1000),
      quantity: 3,
    });
  });

  it("does not charge when a paid seat is already free", async () => {
    arrange({ members: 1, quantity: 2 });

    const result = await preview();

    expect(result).toMatchObject({ needsCharge: false, quantity: 2 });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("does not charge while the subscription is not active", async () => {
    arrange({ members: 1, quantity: 1, status: "past_due" });

    const result = await preview();

    expect(result).toMatchObject({ needsCharge: false });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("reports nothing to bill for a workspace without a subscription", async () => {
    arrange({ members: 1, subscription: false });

    const result = await preview();

    expect(result).toEqual({
      amountPerSeatCents: null,
      currency: null,
      needsCharge: false,
      periodEnd: null,
      quantity: 2,
    });
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("keeps the charge but drops the amount when Stripe reports no unit price", async () => {
    arrange({ amount: null, members: 1, quantity: 1 });

    await expect(preview()).resolves.toMatchObject({
      amountPerSeatCents: null,
      needsCharge: true,
      quantity: 2,
    });
  });
});
