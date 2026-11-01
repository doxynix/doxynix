const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
const IDEMPOTENCY_KEY_PREFIX = "doxynix";

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

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

// Stripe's 255-character limit is the tightest channel we use, and a key is not a place for PII.
export function billingIdempotencyKey(input: {
  environment: string;
  operation: string;
  requestId: string;
  workspaceId: string;
}): string {
  const key = [
    IDEMPOTENCY_KEY_PREFIX,
    input.environment,
    input.operation,
    input.workspaceId,
    input.requestId,
  ]
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "")
    .join(":");

  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new BillingIdempotencyKeyError(
      "BILLING_IDEMPOTENCY_KEY_TOO_LONG",
      `Idempotency key exceeds ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
    );
  }

  if (EMAIL_PATTERN.test(key)) {
    throw new BillingIdempotencyKeyError(
      "BILLING_IDEMPOTENCY_KEY_CONTAINS_EMAIL",
      "Idempotency key must not contain an email address",
    );
  }

  return key;
}
