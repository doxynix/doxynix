import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import {
  periodStartOf,
  recordAnalysisUsage,
  recordCacheHitUsage,
  releaseUsage,
  reserveUsage,
  settleUsage,
} from "./billing.usage";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const MODEL = "gemini-3.5-flash-lite";
const JANUARY = new Date("2026-01-15T10:00:00.000Z");
const FEBRUARY = new Date("2026-02-02T10:00:00.000Z");

type EventRow = {
  costCents: bigint;
  id: string;
  idempotencyKey: string;
  inputTokens: number;
  kind: string;
  model?: null | string;
};

type RollupRow = {
  aiTokensUsed: number;
  analysesCount: number;
  costCents: bigint;
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields", {
    clientVersion: Prisma.prismaVersion.client,
    code: "P2002",
  });
}

function createFakeDb() {
  const events = new Map<string, EventRow>();
  const rollups = new Map<string, RollupRow>();
  let eventCount = 0;

  const db = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    usageEvent: {
      create: vi.fn(async ({ data }: { data: Omit<EventRow, "id"> }) => {
        if (events.has(data.idempotencyKey)) {
          throw uniqueViolation();
        }

        eventCount += 1;
        const row = { ...data, id: `ue_${eventCount}` };
        events.set(data.idempotencyKey, row);

        return row;
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { idempotencyKey: string } }) =>
          events.get(where.idempotencyKey) ?? null,
      ),
    },
    workspaceUsage: {
      upsert: vi.fn(
        async ({
          create,
          update,
          where,
        }: {
          create: RollupRow & { periodStart: Date; workspaceId: string };
          update: {
            aiTokensUsed: { increment: number };
            analysesCount: { increment: number };
            costCents: { increment: bigint };
          };
          where: { workspaceId_periodStart: { periodStart: Date; workspaceId: string } };
        }) => {
          const key = `${where.workspaceId_periodStart.workspaceId}:${where.workspaceId_periodStart.periodStart.toISOString()}`;
          const existing = rollups.get(key);

          if (existing == null) {
            const row: RollupRow = {
              aiTokensUsed: create.aiTokensUsed,
              analysesCount: create.analysesCount,
              costCents: create.costCents,
            };
            rollups.set(key, row);

            return row;
          }

          existing.aiTokensUsed += update.aiTokensUsed.increment;
          existing.analysesCount += update.analysesCount.increment;
          existing.costCents += update.costCents.increment;

          return existing;
        },
      ),
    },
  };

  return { db: db as unknown as DbClient, events, rollups };
}

function rollupFor(rollups: Map<string, RollupRow>, at: Date): RollupRow | undefined {
  return rollups.get(`${WORKSPACE_ID}:${periodStartOf(at).toISOString()}`);
}

describe("reserve and settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reserves the estimate before the call", async () => {
    const fake = createFakeDb();

    const reservation = await reserveUsage(fake.db, {
      analysisId: "analysis_1",
      estimatedTokens: 1200,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });

    expect(reservation.reservedTokens).toBe(1200);
    expect(fake.events.get("call-1")?.kind).toBe("RESERVE");
    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(1200);
  });

  it("settles the fact and releases the unused reservation", async () => {
    const fake = createFakeDb();

    await reserveUsage(fake.db, {
      estimatedTokens: 1200,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    const settled = await settleUsage(fake.db, {
      idempotencyKey: "call-1",
      model: MODEL,
      now: JANUARY,
      provider: "google",
      usage: { cachedInputTokens: 100, inputTokens: 500, outputTokens: 100 },
      workspaceId: WORKSPACE_ID,
    });

    expect(settled.tokens).toBe(700);
    expect(settled.releasedTokens).toBe(500);
    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(700);
    expect(rollupFor(fake.rollups, JANUARY)?.costCents).toBeGreaterThan(BigInt(0));
  });

  it("does not double count a duplicate reservation", async () => {
    const fake = createFakeDb();

    await reserveUsage(fake.db, {
      estimatedTokens: 1000,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    const duplicate = await reserveUsage(fake.db, {
      estimatedTokens: 1000,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });

    expect(duplicate.reservedTokens).toBe(1000);
    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(1000);
    expect(fake.events.size).toBe(1);
  });

  it("does not double count a duplicate settlement", async () => {
    const fake = createFakeDb();
    const usage = { cachedInputTokens: 0, inputTokens: 400, outputTokens: 100 };

    await reserveUsage(fake.db, {
      estimatedTokens: 1000,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    await settleUsage(fake.db, {
      idempotencyKey: "call-1",
      model: MODEL,
      now: JANUARY,
      provider: "google",
      usage,
      workspaceId: WORKSPACE_ID,
    });
    const duplicate = await settleUsage(fake.db, {
      idempotencyKey: "call-1",
      model: MODEL,
      now: JANUARY,
      provider: "google",
      usage,
      workspaceId: WORKSPACE_ID,
    });

    expect(duplicate.tokens).toBe(0);
    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(500);
  });

  it("releases a failed call without a stuck reservation", async () => {
    const fake = createFakeDb();

    await reserveUsage(fake.db, {
      estimatedTokens: 900,
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    await releaseUsage(fake.db, {
      idempotencyKey: "call-1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });

    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(0);
    expect(fake.events.get("call-1:release")?.kind).toBe("SETTLE");
  });

  it("keeps separate rollups per calendar month", async () => {
    const fake = createFakeDb();

    await reserveUsage(fake.db, {
      estimatedTokens: 100,
      idempotencyKey: "period-jan",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    await reserveUsage(fake.db, {
      estimatedTokens: 200,
      idempotencyKey: "period-feb",
      now: FEBRUARY,
      workspaceId: WORKSPACE_ID,
    });

    expect(rollupFor(fake.rollups, JANUARY)?.aiTokensUsed).toBe(100);
    expect(rollupFor(fake.rollups, FEBRUARY)?.aiTokensUsed).toBe(200);
  });
});

describe("cache hits and analyses", () => {
  it("records a zero-cost event for a cached analysis without touching the quota", async () => {
    const fake = createFakeDb();

    await recordCacheHitUsage(fake.db, {
      analysisId: "analysis_1",
      idempotencyKey: "cache:repo:sha",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });

    const event = fake.events.get("cache:repo:sha");

    expect(event?.kind).toBe("CACHE_HIT");
    expect(event?.costCents).toBe(BigInt(0));
    expect(event?.inputTokens).toBe(0);
    expect(fake.rollups.size).toBe(0);
  });

  it("consumes one quota unit for a fresh analysis", async () => {
    const fake = createFakeDb();

    await recordAnalysisUsage(fake.db, {
      analysisId: "analysis_1",
      idempotencyKey: "analysis:1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });
    await recordAnalysisUsage(fake.db, {
      analysisId: "analysis_1",
      idempotencyKey: "analysis:1",
      now: JANUARY,
      workspaceId: WORKSPACE_ID,
    });

    expect(rollupFor(fake.rollups, JANUARY)?.analysesCount).toBe(1);
  });
});
