import { UsageEventKind as USAGE_EVENT_KIND } from "@doxynix/shared";
import { Prisma } from "@prisma/client";

import type { DbClient } from "@/server/core/db";

import { costCentsFor, type TokenUsage, totalTokens } from "./price";

export type UsageReservation = {
  idempotencyKey: string;
  reservedTokens: number;
};

export type SettledUsage = {
  costCents: bigint;
  releasedTokens: number;
  tokens: number;
};

// The quota period is a UTC calendar month; `@db.Date` keeps it comparable across time zones.
export function periodStartOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// `DbClient` is a union: a transaction client has no `$transaction`, so nested calls run inline.
// Accepts the root client or an already-open transaction: inside a caller's transaction we must
// reuse it, because a nested `$transaction` would commit outside the caller's atomic block.
async function withTransaction<T>(db: DbClient, fn: (tx: DbClient) => Promise<T>): Promise<T> {
  if (!("$transaction" in db)) {
    return fn(db);
  }

  return db.$transaction(fn);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function bumpUsage(
  tx: DbClient,
  input: {
    analyses: number;
    costCents: bigint;
    now: Date;
    tokens: number;
    workspaceId: string;
  },
): Promise<void> {
  const periodStart = periodStartOf(input.now).toISOString().slice(0, 10);

  // One statement per event. The insert clamps a fresh row at zero; the conflict branch adds the
  // raw delta, because a release is negative and would be lost if EXCLUDED were already clamped.
  await tx.$executeRaw`
    INSERT INTO "workspace_usage" (
      "workspace_id", "period_start", "ai_tokens_used", "analyses_count", "cost_cents", "updated_at"
    )
    VALUES (
      ${input.workspaceId}::uuid,
      ${periodStart}::date,
      GREATEST(0, ${input.tokens}::int),
      ${input.analyses}::int,
      GREATEST(0, ${input.costCents}::bigint),
      now()
    )
    ON CONFLICT ("workspace_id", "period_start") DO UPDATE SET
      "ai_tokens_used" = GREATEST(0, "workspace_usage"."ai_tokens_used" + ${input.tokens}::int),
      "analyses_count" = "workspace_usage"."analyses_count" + ${input.analyses}::int,
      "cost_cents" = GREATEST(0, "workspace_usage"."cost_cents" + ${input.costCents}::bigint),
      "updated_at" = now()
  `;
}

async function reservedTokensOf(db: DbClient, idempotencyKey: string): Promise<number> {
  const reservation = await db.usageEvent.findUnique({
    select: { inputTokens: true },
    where: { idempotencyKey },
  });

  return reservation?.inputTokens ?? 0;
}

// Reserves an estimate before the model call so a burst cannot overshoot the quota. The unique key
// makes a retry of the same attempt a no-op instead of a second charge.
export async function reserveUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    estimatedTokens: number;
    idempotencyKey: string;
    now?: Date;
    workspaceId: string;
  },
): Promise<UsageReservation> {
  const now = input.now ?? new Date();
  const estimatedTokens = Math.max(0, Math.trunc(input.estimatedTokens));

  try {
    await withTransaction(db, async (tx) => {
      await tx.usageEvent.create({
        data: {
          analysisId: input.analysisId ?? null,
          costCents: BigInt(0),
          idempotencyKey: input.idempotencyKey,
          inputTokens: estimatedTokens,
          kind: USAGE_EVENT_KIND.RESERVE,
          occurredAt: now,
          workspaceId: input.workspaceId,
        },
      });

      await bumpUsage(tx, {
        analyses: 0,
        costCents: BigInt(0),
        now,
        tokens: estimatedTokens,
        workspaceId: input.workspaceId,
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    return {
      idempotencyKey: input.idempotencyKey,
      reservedTokens: await reservedTokensOf(db, input.idempotencyKey),
    };
  }

  return { idempotencyKey: input.idempotencyKey, reservedTokens: estimatedTokens };
}

// Settles the actual usage and releases the difference between the estimate and the fact.
export async function settleUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    idempotencyKey: string;
    model: string;
    now?: Date;
    provider: string;
    usage: TokenUsage;
    workspaceId: string;
  },
): Promise<SettledUsage> {
  const now = input.now ?? new Date();
  const tokens = totalTokens(input.usage);
  const costCents = costCentsFor(input.model, input.usage, now);
  const reservedTokens = await reservedTokensOf(db, input.idempotencyKey);

  try {
    await withTransaction(db, async (tx) => {
      await tx.usageEvent.create({
        data: {
          analysisId: input.analysisId ?? null,
          cachedInputTokens: input.usage.cachedInputTokens,
          costCents,
          idempotencyKey: `${input.idempotencyKey}:settle`,
          inputTokens: input.usage.inputTokens,
          kind: USAGE_EVENT_KIND.SETTLE,
          model: input.model,
          occurredAt: now,
          outputTokens: input.usage.outputTokens,
          provider: input.provider,
          workspaceId: input.workspaceId,
        },
      });

      await bumpUsage(tx, {
        analyses: 0,
        costCents,
        now,
        tokens: tokens - reservedTokens,
        workspaceId: input.workspaceId,
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // Already settled: the rollup must not move twice.
    return { costCents: BigInt(0), releasedTokens: 0, tokens: 0 };
  }

  return {
    costCents,
    releasedTokens: Math.max(0, reservedTokens - tokens),
    tokens,
  };
}

// A failed attempt releases its whole reservation; nothing is left "reserved forever".
export async function releaseUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    idempotencyKey: string;
    now?: Date;
    workspaceId: string;
  },
): Promise<void> {
  const now = input.now ?? new Date();
  const reservedTokens = await reservedTokensOf(db, input.idempotencyKey);

  try {
    await withTransaction(db, async (tx) => {
      await tx.usageEvent.create({
        data: {
          analysisId: input.analysisId ?? null,
          costCents: BigInt(0),
          idempotencyKey: `${input.idempotencyKey}:release`,
          inputTokens: 0,
          kind: USAGE_EVENT_KIND.SETTLE,
          occurredAt: now,
          workspaceId: input.workspaceId,
        },
      });

      await bumpUsage(tx, {
        analyses: 0,
        costCents: BigInt(0),
        now,
        tokens: -reservedTokens,
        workspaceId: input.workspaceId,
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}

// A cached re-analysis is free: it records a zero-cost event and does not consume a quota unit.
export async function recordCacheHitUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    idempotencyKey: string;
    now?: Date;
    workspaceId: string;
  },
): Promise<void> {
  const now = input.now ?? new Date();

  try {
    await db.usageEvent.create({
      data: {
        analysisId: input.analysisId ?? null,
        costCents: BigInt(0),
        idempotencyKey: input.idempotencyKey,
        inputTokens: 0,
        kind: USAGE_EVENT_KIND.CACHE_HIT,
        occurredAt: now,
        workspaceId: input.workspaceId,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}

// One fresh analysis consumes one quota unit; the AI-call events only add tokens and cost.
export async function recordAnalysisUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    idempotencyKey: string;
    now?: Date;
    workspaceId: string;
  },
): Promise<void> {
  const now = input.now ?? new Date();

  try {
    await withTransaction(db, async (tx) => {
      await tx.usageEvent.create({
        data: {
          analysisId: input.analysisId ?? null,
          costCents: BigInt(0),
          idempotencyKey: input.idempotencyKey,
          inputTokens: 0,
          kind: USAGE_EVENT_KIND.ANALYSIS,
          occurredAt: now,
          workspaceId: input.workspaceId,
        },
      });

      await bumpUsage(tx, {
        analyses: 1,
        costCents: BigInt(0),
        now,
        tokens: 0,
        workspaceId: input.workspaceId,
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}

// Returns the quota unit when the analysis never started (queue failure), so a broken enqueue does
// not consume a customer's monthly allowance.
export async function releaseAnalysisUsage(
  db: DbClient,
  input: {
    analysisId?: null | string;
    idempotencyKey: string;
    now?: Date;
    workspaceId: string;
  },
): Promise<void> {
  const now = input.now ?? new Date();

  try {
    await withTransaction(db, async (tx) => {
      await tx.usageEvent.create({
        data: {
          analysisId: input.analysisId ?? null,
          costCents: BigInt(0),
          idempotencyKey: `${input.idempotencyKey}:release`,
          inputTokens: 0,
          kind: USAGE_EVENT_KIND.ANALYSIS_RELEASE,
          occurredAt: now,
          workspaceId: input.workspaceId,
        },
      });

      await bumpUsage(tx, {
        analyses: -1,
        costCents: BigInt(0),
        now,
        tokens: 0,
        workspaceId: input.workspaceId,
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}
