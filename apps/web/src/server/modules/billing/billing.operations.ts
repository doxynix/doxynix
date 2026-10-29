import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";

import { BillingCatalogError } from "./billing.catalog";
import {
  type BillingOperationRequest,
  BillingOperationRequestSchema,
  BillingOperationStatus,
} from "./billing.schemas";

const STRIPE_IDEMPOTENCY_KEY_MAX_LENGTH = 255;
const STRIPE_IDEMPOTENCY_KEY_PREFIX = "doxynix";

// Keys whose values never belong in a stored result: links, personal data and money. Stripe
// amounts are the ledger's job, not an operation payload.
const SENSITIVE_KEY_PATTERN =
  /address|amount|card|cents|email|iban|price|secret|tax|token|total|url/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const REDACTED = "[redacted]";
const MAX_RESULT_DEPTH = 6;

const OPERATION_SELECT = {
  errorCode: true,
  id: true,
  requestHash: true,
  resultJson: true,
  status: true,
  stripeObjectId: true,
} as const;

export type BillingOperationRow = {
  errorCode: null | string;
  id: string;
  requestHash: string;
  resultJson: unknown;
  status: string;
  stripeObjectId: null | string;
};

export type BillingOperationStart =
  | { operation: BillingOperationRow; result: unknown; state: "completed" }
  | { operation: BillingOperationRow; state: "failed" }
  | { operation: BillingOperationRow; state: "in_progress" }
  | { operation: BillingOperationRow; state: "started" };

export type BeginBillingOperationInput = {
  actorUserId?: null | string;
  operation: string;
  requestBody: unknown;
  requestId: string;
  workspaceId: string;
};

export type BillingOperationExecution = {
  result?: unknown;
  stripeObjectId?: null | string;
};

export type RunBillingOperationInput = BeginBillingOperationInput & {
  execute: () => Promise<BillingOperationExecution>;
};

export type BillingOperationRun = {
  operationId: string;
  replayed: boolean;
  result: unknown;
};

export type BillingIdempotencyKeyErrorCode =
  | "BILLING_IDEMPOTENCY_KEY_CONTAINS_EMAIL"
  | "BILLING_IDEMPOTENCY_KEY_TOO_LONG";

export class BillingIdempotencyKeyError extends Error {
  readonly code: BillingIdempotencyKeyErrorCode;

  constructor(code: BillingIdempotencyKeyErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BillingIdempotencyKeyError";
  }
}

// Deterministic serialization: sorted keys, explicit number/Date handling, undefined dropped.
// Two bodies that differ only in key order must hash identically.
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function canonicalRequestHash(requestBody: unknown): string {
  return createHash("sha256").update(canonicalJson(requestBody)).digest("hex");
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return URL_PATTERN.test(value) || EMAIL_PATTERN.test(value) ? REDACTED : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= MAX_RESULT_DEPTH) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const clean: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }

      clean[key] = sanitizeValue(nested, depth + 1);
    }

    return clean;
  }

  return REDACTED;
}

// Safe to persist: no links, no personal data, no money.
export function sanitizeBillingResult(result: unknown): unknown {
  return sanitizeValue(result, 0);
}

// Stripe rejects idempotency keys longer than 255 characters, and a key is not a place for PII.
export function stripeIdempotencyKey(input: {
  environment: string;
  operation: string;
  requestId: string;
  workspaceId: string;
}): string {
  const key = [
    STRIPE_IDEMPOTENCY_KEY_PREFIX,
    input.environment,
    input.operation,
    input.workspaceId,
    input.requestId,
  ]
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "")
    .join(":");

  if (key.length > STRIPE_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new BillingIdempotencyKeyError(
      "BILLING_IDEMPOTENCY_KEY_TOO_LONG",
      `Stripe idempotency key exceeds ${STRIPE_IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
    );
  }

  if (EMAIL_PATTERN.test(key)) {
    throw new BillingIdempotencyKeyError(
      "BILLING_IDEMPOTENCY_KEY_CONTAINS_EMAIL",
      "Stripe idempotency key must not contain an email address",
    );
  }

  return key;
}

function idempotencyConflict(): TRPCError {
  return new TRPCError({ code: "CONFLICT", message: "BILLING_IDEMPOTENCY_CONFLICT" });
}

function operationInProgress(): TRPCError {
  return new TRPCError({ code: "CONFLICT", message: "BILLING_OPERATION_IN_PROGRESS" });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function errorCodeFor(error: unknown): string {
  if (error instanceof TRPCError) {
    return error.message.slice(0, 64);
  }

  if (error instanceof BillingCatalogError) {
    return error.code;
  }

  return "BILLING_OPERATION_FAILED";
}

function parseRequest(input: BeginBillingOperationInput): BillingOperationRequest {
  const parsed = BillingOperationRequestSchema.safeParse({
    operation: input.operation,
    requestId: input.requestId,
    workspaceId: input.workspaceId,
  });

  if (!parsed.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_BILLING_OPERATION_REQUEST" });
  }

  return parsed.data;
}

function existingOperationState(operation: BillingOperationRow): BillingOperationStart {
  if (operation.status === BillingOperationStatus.COMPLETED) {
    return { operation, result: operation.resultJson, state: "completed" };
  }

  if (operation.status === BillingOperationStatus.FAILED) {
    return { operation, state: "failed" };
  }

  // STARTED, or a status this code does not know: never re-run a command we cannot prove failed.
  return { operation, state: "in_progress" };
}

export async function beginBillingOperation(
  db: DbClient,
  input: BeginBillingOperationInput,
): Promise<BillingOperationStart> {
  const request = parseRequest(input);
  const requestHash = canonicalRequestHash(input.requestBody);

  try {
    const created = await db.billingOperation.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        operation: request.operation,
        requestHash,
        requestId: request.requestId,
        status: BillingOperationStatus.STARTED,
        workspaceId: request.workspaceId,
      },
      select: OPERATION_SELECT,
    });

    return { operation: created, state: "started" };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // A concurrent caller won the insert; the unique constraint, not the queue, is the guarantee.
    const existing = await db.billingOperation.findUnique({
      select: OPERATION_SELECT,
      where: {
        workspaceId_requestId: {
          requestId: request.requestId,
          workspaceId: request.workspaceId,
        },
      },
    });

    if (existing == null) {
      throw error;
    }

    if (existing.requestHash !== requestHash) {
      throw idempotencyConflict();
    }

    return existingOperationState(existing);
  }
}

export async function completeBillingOperation(
  db: DbClient,
  input: { operationId: string; result?: unknown; stripeObjectId?: null | string },
): Promise<void> {
  const sanitized = sanitizeBillingResult(input.result);
  const resultJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
    sanitized === undefined ? Prisma.DbNull : (sanitized as Prisma.InputJsonValue);

  await db.billingOperation.update({
    data: {
      errorCode: null,
      resultJson,
      status: BillingOperationStatus.COMPLETED,
      stripeObjectId: input.stripeObjectId ?? null,
    },
    where: { id: input.operationId },
  });
}

export async function failBillingOperation(
  db: DbClient,
  input: { errorCode: string; operationId: string },
): Promise<void> {
  await db.billingOperation.update({
    data: { errorCode: input.errorCode.slice(0, 64), status: BillingOperationStatus.FAILED },
    where: { id: input.operationId },
  });
}

export async function runBillingOperation(
  db: DbClient,
  input: RunBillingOperationInput,
): Promise<BillingOperationRun> {
  const start = await beginBillingOperation(db, input);

  if (start.state === "completed") {
    return { operationId: start.operation.id, replayed: true, result: start.result };
  }

  if (start.state === "in_progress") {
    throw operationInProgress();
  }

  if (start.state === "failed") {
    // Retry after a failure is allowed, but only one retry may win the transition.
    const resumed = await db.billingOperation.updateMany({
      data: { errorCode: null, status: BillingOperationStatus.STARTED },
      where: { id: start.operation.id, status: BillingOperationStatus.FAILED },
    });

    if (resumed.count === 0) {
      throw operationInProgress();
    }
  }

  try {
    const execution = await input.execute();

    await completeBillingOperation(db, {
      operationId: start.operation.id,
      result: execution.result,
      stripeObjectId: execution.stripeObjectId,
    });

    return { operationId: start.operation.id, replayed: false, result: execution.result };
  } catch (error) {
    try {
      await failBillingOperation(db, {
        errorCode: errorCodeFor(error),
        operationId: start.operation.id,
      });
    } catch {
      // The operation stays STARTED; the caller still receives the original failure.
    }

    throw error;
  }
}
