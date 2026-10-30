import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { proPlan } from "./billing.catalog";
import { changeSeats, previewPlanChange } from "./billing.plan-changes";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5f";

const stripeMock = vi.hoisted(() => ({
  invoices: { createPreview: vi.fn() },
  subscriptions: { update: vi.fn() },
}));

vi.mock("./billing.stripe", () => ({
  getStripeClient: () => stripeMock,
  stripeEnvironment: () => "test",
}));

type OperationRow = {
  errorCode: null | string;
  id: string;
  requestHash: string;
  resultJson: unknown;
  status: string;
  stripeObjectId: null | string;
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

function mirror(overrides: Record<string, unknown> = {}) {
  return {
    currency: "usd",
    quantity: 2,
    stripePriceId: proPlan().priceId,
    stripeStatus: "active",
    stripeSubscriptionId: "sub_1",
    stripeSubscriptionItemId: "si_1",
    ...overrides,
  };
}

function createFakeDb(
  options: { entitlementState?: string; members?: number; mirror?: unknown } = {},
) {
  let members = options.members ?? 2;
  let operationCount = 0;
  const operations = new Map<string, OperationRow>();

  const db = {
    billingOperation: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: { requestHash: string; requestId: string; status: string; workspaceId: string };
        }) => {
          const key = `${data.workspaceId}:${data.requestId}`;

          if (operations.has(key)) {
            throw uniqueViolation();
          }

          operationCount += 1;
          const row: OperationRow = {
            errorCode: null,
            id: `op_${operationCount}`,
            requestHash: data.requestHash,
            resultJson: null,
            status: data.status,
            stripeObjectId: null,
          };
          operations.set(key, row);

          return row;
        },
      ),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { workspaceId_requestId: { requestId: string; workspaceId: string } };
        }) => {
          return (
            operations.get(
              `${where.workspaceId_requestId.workspaceId}:${where.workspaceId_requestId.requestId}`,
            ) ?? null
          );
        },
      ),
      update: vi.fn(
        async ({ data, where }: { data: Partial<OperationRow>; where: { id: string } }) => {
          const row = [...operations.values()].find((candidate) => candidate.id === where.id);

          if (row == null) {
            throw new Error("operation not found");
          }

          Object.assign(row, data);

          return row;
        },
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    billingSubscription: {
      findFirst: vi.fn().mockResolvedValue(options.mirror ?? mirror()),
    },
    workspaceEntitlement: {
      findUnique: vi.fn().mockResolvedValue({
        accessState: options.entitlementState ?? "ACTIVE",
        aiTokensPerMonth: null,
        analysesPerMonth: null,
        autoResync: true,
        graceEndsAt: null,
        planCode: "PRO",
        privateReposAllowed: true,
        prReviews: true,
        reposLimit: null,
        revision: BigInt(1),
        seatLimit: 5,
      }),
      upsert: vi.fn(),
    },
    workspaceMember: { count: vi.fn(async () => members) },
    workspaceUsage: { findUnique: vi.fn().mockResolvedValue(null) },
  };

  return {
    db: db as unknown as DbClient,
    operations,
    setMembers: (value: number) => {
      members = value;
    },
  };
}

function changeInput(fake: ReturnType<typeof createFakeDb>, quantity: number) {
  return {
    actorUserId: USER_ID,
    db: fake.db,
    quantity,
    requestId: REQUEST_ID,
    workspaceId: WORKSPACE_ID,
  };
}

function previewInput(fake: ReturnType<typeof createFakeDb>, quantity: number) {
  return {
    actorUserId: USER_ID,
    db: fake.db,
    quantity,
    workspaceId: WORKSPACE_ID,
  };
}

describe("previewPlanChange", () => {
  beforeEach(() => {
    stripeMock.invoices.createPreview.mockReset().mockResolvedValue({
      amount_due: 1200,
      currency: "usd",
    });
    stripeMock.subscriptions.update.mockReset();
  });

  it("previews without mutating the subscription", async () => {
    const fake = createFakeDb();

    const preview = await previewPlanChange(previewInput(fake, 3));

    expect(preview).toEqual({
      amountDueCents: 1200,
      currency: "usd",
      prorationBehavior: "always_invoice",
      quantity: 3,
    });
    expect(stripeMock.invoices.createPreview).toHaveBeenCalledTimes(1);
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("sends the existing item id and the requested quantity", async () => {
    const fake = createFakeDb();

    await previewPlanChange(previewInput(fake, 3));

    expect(stripeMock.invoices.createPreview).toHaveBeenCalledWith({
      subscription: "sub_1",
      subscription_details: {
        items: [{ id: "si_1", quantity: 3 }],
        proration_behavior: "always_invoice",
      },
    });
  });

  it("previews a downgrade with create_prorations", async () => {
    const fake = createFakeDb({ members: 1 });

    const preview = await previewPlanChange(previewInput(fake, 1));

    expect(preview.prorationBehavior).toBe("create_prorations");
    expect(stripeMock.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_details: expect.objectContaining({ proration_behavior: "create_prorations" }),
      }),
    );
  });
});

describe("changeSeats", () => {
  beforeEach(() => {
    stripeMock.subscriptions.update.mockReset().mockResolvedValue({ id: "sub_1" });
    stripeMock.invoices.createPreview.mockReset();
  });

  it("upgrades with always_invoice and the existing item id", async () => {
    const fake = createFakeDb();

    const result = await changeSeats(changeInput(fake, 4));

    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      {
        items: [{ id: "si_1", quantity: 4 }],
        proration_behavior: "always_invoice",
      },
      { idempotencyKey: expect.stringContaining(`:subscription:${WORKSPACE_ID}:${REQUEST_ID}`) },
    );
    expect(result).toMatchObject({
      operationId: "op_1",
      prorationBehavior: "always_invoice",
      quantity: 4,
      replayed: false,
    });
  });

  it("downgrades with create_prorations", async () => {
    const fake = createFakeDb({ members: 1 });

    const result = await changeSeats(changeInput(fake, 1));

    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_1",
      {
        items: [{ id: "si_1", quantity: 1 }],
        proration_behavior: "create_prorations",
      },
      expect.anything(),
    );
    expect(result.prorationBehavior).toBe("create_prorations");
  });

  it("rejects a downgrade below the active member count before calling Stripe", async () => {
    const fake = createFakeDb({ members: 3, mirror: mirror({ quantity: 5 }) });

    await expect(changeSeats(changeInput(fake, 2))).rejects.toMatchObject({
      message: "SEATS_BELOW_MEMBERS",
    });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("rejects a delinquent subscription", async () => {
    const fake = createFakeDb({ mirror: mirror({ stripeStatus: "past_due" }) });

    await expect(changeSeats(changeInput(fake, 3))).rejects.toMatchObject({
      message: "BILLING_NOT_CHANGEABLE",
    });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("rejects a workspace in REVIEW", async () => {
    const fake = createFakeDb({ entitlementState: "REVIEW" });

    await expect(changeSeats(changeInput(fake, 3))).rejects.toMatchObject({
      message: "BILLING_NOT_CHANGEABLE",
    });
  });

  it("does not call Stripe twice for a repeated request id", async () => {
    const fake = createFakeDb();

    const first = await changeSeats(changeInput(fake, 3));
    const second = await changeSeats(changeInput(fake, 3));

    expect(stripeMock.subscriptions.update).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });

  it("never touches the entitlement projection", async () => {
    const fake = createFakeDb();

    await changeSeats(changeInput(fake, 3));

    expect(fake.db.workspaceEntitlement.upsert).not.toHaveBeenCalled();
  });
});
