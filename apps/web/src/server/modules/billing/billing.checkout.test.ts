import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { createCheckoutSession } from "./billing.checkout";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REQUEST_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5f";
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_new";

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { create: vi.fn() } },
  customers: { create: vi.fn() },
}));

vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));

type OperationRow = {
  errorCode: null | string;
  id: string;
  requestHash: string;
  resultJson: unknown;
  status: string;
  stripeObjectId: null | string;
};

type CustomerRow = {
  externalCustomerId: string;
  livemode: boolean;
  provider: string;
  workspaceId: string;
};

type SessionRow = {
  stripeCheckoutSessionId: string;
  stripeCustomerId: string;
  stripeStatus: null | string;
  workspaceId: string;
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

// In-memory stand-in for the billing tables: the operation ledger is exercised for real, so the
// replay/conflict behaviour under test is the production one, not a stub.
function createFakeDb(
  options: { currentSubscription?: boolean; existingCustomerId?: string; members?: number } = {},
) {
  let members = options.members ?? 2;
  let operationCount = 0;
  const operations = new Map<string, OperationRow>();
  const customers: Array<CustomerRow> =
    options.existingCustomerId == null
      ? []
      : [
          {
            externalCustomerId: options.existingCustomerId,
            livemode: false,
            provider: "stripe",
            workspaceId: WORKSPACE_ID,
          },
        ];
  const sessions: Array<SessionRow> = [];

  const findById = (id: string) => [...operations.values()].find((row) => row.id === id);

  const db = {
    billingCheckoutSession: {
      create: async ({ data }: { data: SessionRow }) => {
        sessions.push(data);

        return data;
      },
    },
    billingCustomer: {
      findFirst: async ({ where }: { where: { provider: string; workspaceId: string } }) =>
        customers.find(
          (row) => row.provider === where.provider && row.workspaceId === where.workspaceId,
        ) ?? null,
      upsert: async ({
        create,
        where,
      }: {
        create: CustomerRow;
        where: { workspaceId_provider: { provider: string; workspaceId: string } };
      }) => {
        const existing = customers.find(
          (row) =>
            row.provider === where.workspaceId_provider.provider &&
            row.workspaceId === where.workspaceId_provider.workspaceId,
        );

        if (existing != null) {
          return existing;
        }

        customers.push(create);

        return create;
      },
    },
    billingOperation: {
      create: async ({
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
      findUnique: async ({
        where,
      }: {
        where: { workspaceId_requestId: { requestId: string; workspaceId: string } };
      }) =>
        operations.get(
          `${where.workspaceId_requestId.workspaceId}:${where.workspaceId_requestId.requestId}`,
        ) ?? null,
      update: async ({ data, where }: { data: Partial<OperationRow>; where: { id: string } }) => {
        const row = findById(where.id);

        if (row == null) {
          throw new Error("operation not found");
        }

        Object.assign(row, data);

        return row;
      },
      updateMany: async ({
        data,
        where,
      }: {
        data: Partial<OperationRow>;
        where: { id: string; status: string };
      }) => {
        const row = findById(where.id);

        if (row == null || row.status !== where.status) {
          return { count: 0 };
        }

        Object.assign(row, data);

        return { count: 1 };
      },
    },
    billingSubscription: {
      findFirst: async () => (options.currentSubscription === true ? { id: "sub_current" } : null),
    },
    workspaceMember: { count: async () => members },
  };

  return {
    db: db as unknown as DbClient,
    sessions,
    setMembers: (value: number) => {
      members = value;
    },
  };
}

function checkoutCall() {
  const call = stripeMock.checkout.sessions.create.mock.calls.at(0);

  expect(call).toBeDefined();

  return call as [Record<string, unknown>, { idempotencyKey: string }];
}

function checkoutInput(fake: ReturnType<typeof createFakeDb>) {
  return {
    actorUserId: USER_ID,
    db: fake.db,
    requestId: REQUEST_ID,
    workspaceId: WORKSPACE_ID,
  };
}

describe("createCheckoutSession", () => {
  beforeEach(() => {
    stripeMock.customers.create.mockReset().mockResolvedValue({ id: "cus_new", livemode: false });
    stripeMock.checkout.sessions.create
      .mockReset()
      .mockResolvedValue({ id: "cs_new", status: "open", url: CHECKOUT_URL });
  });

  it("creates a classic subscription session with tax, address and seat quantity", async () => {
    const fake = createFakeDb();

    const result = await createCheckoutSession(checkoutInput(fake));

    const [params, options] = checkoutCall();

    expect(params).toMatchObject({
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer: "cus_new",
      customer_update: { address: "auto" },
      line_items: [{ price: expect.stringMatching(/^price_/), quantity: 2 }],
      mode: "subscription",
      subscription_data: { billing_mode: { type: "classic" } },
      tax_id_collection: { enabled: true, required: "never" },
    });
    expect(params).not.toHaveProperty("payment_method_types");
    expect(params).not.toHaveProperty("metadata");
    expect(params).not.toHaveProperty("subscription_data.trial_period_days");
    expect(params.success_url).toContain("/dashboard/settings/members?checkout=success");
    expect(params.cancel_url).toContain("/dashboard/settings/members?checkout=cancel");
    expect(options.idempotencyKey).toContain(":checkout:");
    expect(options.idempotencyKey).toContain(REQUEST_ID);
    expect(result).toEqual({ sessionId: "cs_new", url: CHECKOUT_URL });
    expect(fake.sessions).toEqual([
      {
        stripeCheckoutSessionId: "cs_new",
        stripeCustomerId: "cus_new",
        stripeStatus: "open",
        workspaceId: WORKSPACE_ID,
      },
    ]);
  });

  it("creates the customer with its own idempotency key and no metadata", async () => {
    const fake = createFakeDb();

    await createCheckoutSession(checkoutInput(fake));

    const call = stripeMock.customers.create.mock.calls.at(0);

    expect(call).toEqual([
      {},
      { idempotencyKey: expect.stringContaining(`:customer:${WORKSPACE_ID}:${REQUEST_ID}`) },
    ]);
  });

  it("replays a completed request without calling Stripe again", async () => {
    const fake = createFakeDb();

    await createCheckoutSession(checkoutInput(fake));
    const replayed = await createCheckoutSession(checkoutInput(fake));

    expect(stripeMock.customers.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(replayed).toEqual({ sessionId: "cs_new", url: null });
  });

  it("rejects the same request id when the seat quantity changed", async () => {
    const fake = createFakeDb();

    await createCheckoutSession(checkoutInput(fake));
    fake.setMembers(3);

    await expect(createCheckoutSession(checkoutInput(fake))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "BILLING_IDEMPOTENCY_CONFLICT",
    });
  });

  it("reuses an existing customer instead of creating a second one", async () => {
    const fake = createFakeDb({ existingCustomerId: "cus_existing" });

    await createCheckoutSession(checkoutInput(fake));

    const [params] = checkoutCall();

    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(params.customer).toBe("cus_existing");
  });

  it("refuses a second subscription for a workspace that already has a current one", async () => {
    const fake = createFakeDb({ currentSubscription: true, existingCustomerId: "cus_existing" });

    await expect(createCheckoutSession(checkoutInput(fake))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "ALREADY_SUBSCRIBED",
    });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(fake.sessions).toHaveLength(0);
  });

  it("refuses to sell zero seats", async () => {
    const fake = createFakeDb({ members: 0 });

    await expect(createCheckoutSession(checkoutInput(fake))).rejects.toMatchObject({
      message: "NO_ACTIVE_MEMBERS",
    });
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });
});
