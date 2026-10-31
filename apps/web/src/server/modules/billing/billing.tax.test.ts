import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as EnvFlags from "@/shared/config/env.flags";

import type { DbClient } from "@/server/core/db";

import { applyInvoiceEvent } from "./billing.invoices";
import { recordTaxCollection, runTaxPreflight } from "./billing.tax";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const NOW = new Date("2026-10-31T12:00:00.000Z");

const stripeMock = vi.hoisted(() => ({
  tax: { registrations: { list: vi.fn() }, settings: { retrieve: vi.fn() } },
}));

vi.mock("./billing.stripe", () => ({ getStripeClient: () => stripeMock }));
vi.mock("@/shared/config/env.flags", async (importOriginal) => {
  const actual = await importOriginal<typeof EnvFlags>();

  return { ...actual, IS_PROD: true };
});

function asyncIterable<T>(items: Array<T>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  };
}

function createIssueStore() {
  const issues = new Map<string, { kind: string }>();
  const db = {
    billingIssue: {
      createMany: vi.fn(async ({ data }: { data: Array<{ dedupeKey: string; kind: string }> }) => {
        let count = 0;

        for (const row of data) {
          if (!issues.has(row.dedupeKey)) {
            issues.set(row.dedupeKey, row);
            count += 1;
          }
        }

        return { count };
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  return { db: db as unknown as DbClient, issues };
}

function activeSettings() {
  return { head_office: { address: {} }, status: "active", status_details: {} };
}

describe("runTaxPreflight", () => {
  beforeEach(() => {
    stripeMock.tax.settings.retrieve.mockReset().mockResolvedValue(activeSettings());
    stripeMock.tax.registrations.list.mockReset().mockReturnValue(asyncIterable([]));
  });

  it("blocks a paid launch when tax settings are inactive", async () => {
    stripeMock.tax.settings.retrieve.mockResolvedValue({
      head_office: null,
      status: "pending",
      status_details: { pending: { missing_fields: ["head_office"] } },
    });
    const fake = createIssueStore();

    const result = await runTaxPreflight(fake.db, []);

    expect(result.settingsActive).toBe(false);
    expect([...fake.issues.values()].map((issue) => issue.kind)).toContain("TAX_SETTINGS_INACTIVE");
  });

  it("records a missing registration for every required jurisdiction", async () => {
    stripeMock.tax.registrations.list.mockReturnValue(asyncIterable([{ country: "US" }]));
    const fake = createIssueStore();

    const result = await runTaxPreflight(fake.db, ["US", "CA"]);

    expect(result.missingJurisdictions).toEqual(["CA"]);
    expect([...fake.issues.keys()]).toContain("tax_registration_missing:CA");
    expect([...fake.issues.keys()]).not.toContain("tax_registration_missing:US");
  });

  it("passes when settings are active and every jurisdiction is registered", async () => {
    stripeMock.tax.registrations.list.mockReturnValue(asyncIterable([{ country: "US" }]));
    const fake = createIssueStore();

    const result = await runTaxPreflight(fake.db, ["US"]);

    expect(result).toEqual({
      activeJurisdictions: ["US"],
      missingJurisdictions: [],
      settingsActive: true,
    });
    expect(fake.issues.size).toBe(0);
  });
});

describe("invoice.finalization_failed", () => {
  function createTx() {
    const issues = new Map<string, { kind: string }>();
    const tx = {
      billingIssue: {
        createMany: vi.fn(
          async ({ data }: { data: Array<{ dedupeKey: string; kind: string }> }) => {
            let count = 0;

            for (const row of data) {
              if (!issues.has(row.dedupeKey)) {
                issues.set(row.dedupeKey, row);
                count += 1;
              }
            }

            return { count };
          },
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      billingSubscription: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    return { issues, tx: tx as unknown as DbClient };
  }

  function invoice(overrides: Record<string, unknown> = {}) {
    return {
      automatic_tax: { status: "requires_location_inputs" },
      id: "in_tax_1",
      parent: {
        subscription_details: { subscription: "sub_1" },
        type: "subscription_details",
      },
      ...overrides,
    };
  }

  function input(overrides: Record<string, unknown> = {}) {
    return {
      billingEventId: "be_1",
      eventCreatedAt: NOW,
      eventType: "invoice.finalization_failed",
      invoice: invoice() as never,
      now: NOW,
      ownership: { billingCustomerId: "bc_1", customerId: "cus_1", workspaceId: WORKSPACE_ID },
      subscription: null,
      ...overrides,
    };
  }

  it("marks TAX_LOCATION and raises a critical issue without touching access", async () => {
    const fake = createTx();

    await applyInvoiceEvent(fake.tx, input());

    expect(fake.tx.billingSubscription.updateMany).toHaveBeenCalledWith({
      data: { needsAction: "TAX_LOCATION" },
      where: { stripeSubscriptionId: "sub_1" },
    });
    expect([...fake.issues.values()]).toEqual([expect.objectContaining({ kind: "TAX_LOCATION" })]);
    expect(fake.tx).not.toHaveProperty("workspaceEntitlement");
  });

  it("does not duplicate the issue when the event is replayed", async () => {
    const fake = createTx();

    await applyInvoiceEvent(fake.tx, input());
    await applyInvoiceEvent(fake.tx, input());

    expect(fake.issues.size).toBe(1);
  });

  it("ignores a finalization failure that is not about the tax location", async () => {
    const fake = createTx();

    await applyInvoiceEvent(
      fake.tx,
      input({ invoice: invoice({ automatic_tax: { status: "failed" } }) }),
    );

    expect(fake.issues.size).toBe(0);
    expect(fake.tx.billingSubscription.updateMany).not.toHaveBeenCalled();
  });
});

describe("recordTaxCollection", () => {
  it("records a zero-tax invoice as not collected", async () => {
    const fake = createIssueStore();

    await recordTaxCollection(fake.db, {
      invoice: {
        automatic_tax: { status: "complete" },
        id: "in_zero",
        total: 1900,
        total_taxes: [{ amount: 0 }],
      } as never,
      workspaceId: WORKSPACE_ID,
    });

    expect([...fake.issues.values()]).toEqual([
      expect.objectContaining({ kind: "TAX_NOT_COLLECTED" }),
    ]);
  });

  it("does not flag an invoice that actually collected tax", async () => {
    const fake = createIssueStore();

    await recordTaxCollection(fake.db, {
      invoice: {
        automatic_tax: { status: "complete" },
        id: "in_taxed",
        total: 1900,
        total_taxes: [{ amount: 150 }],
      } as never,
      workspaceId: WORKSPACE_ID,
    });

    expect(fake.issues.size).toBe(0);
  });

  it("raises a configuration issue when no jurisdictions are configured in production", async () => {
    const fake = createIssueStore();

    await runTaxPreflight(fake.db, []);

    expect([...fake.issues.keys()]).toContain("tax_jurisdictions_not_configured");
  });
});
