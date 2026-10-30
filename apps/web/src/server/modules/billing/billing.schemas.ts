import * as z from "zod";

import { PORTAL_RETURN_PATHS } from "./billing.constants";

export const BillingOperationStatus = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  STARTED: "STARTED",
} as const;

export type BillingOperationStatus =
  (typeof BillingOperationStatus)[keyof typeof BillingOperationStatus];

export const BillingOperationStatusSchema = z.enum(BillingOperationStatus);

// Operation names are server-owned constants (CHECKOUT_CREATE, PORTAL_CREATE, ...); the shape is
// constrained here so a client cannot smuggle free text into the ledger-facing column.
export const BillingOperationNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z\d_]*$/);

export const BillingRequestIdSchema = z.uuid();

export const BillingOperationRequestSchema = z.object({
  operation: BillingOperationNameSchema,
  requestId: BillingRequestIdSchema,
  workspaceId: z.uuid(),
});

export type BillingOperationRequest = z.infer<typeof BillingOperationRequestSchema>;

export const CreateCheckoutSchema = z.object({
  requestId: BillingRequestIdSchema,
});

export const CreateCheckoutResultSchema = z.object({
  sessionId: z.string(),
  // Null on replay: the URL is never stored, only returned once.
  url: z.string().nullable(),
});

export type CreateCheckoutResult = z.infer<typeof CreateCheckoutResultSchema>;

// Quota and speed rejections BILL-10 will emit: 402 when the workspace must pay, 403 when a hard
// limit is exceeded, 429 when the caller is merely too fast. Fixed here before the reader lands.
export const BILLING_LIMIT_HTTP_STATUS = {
  LIMIT_EXCEEDED: 403,
  PAYMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
} as const;

export type BillingLimitCode = keyof typeof BILLING_LIMIT_HTTP_STATUS;

export const PlanChangeQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(1000),
});

export const PreviewPlanChangeResultSchema = z.object({
  amountDueCents: z.number().int(),
  currency: z.string(),
  prorationBehavior: z.enum(["always_invoice", "create_prorations"]),
  quantity: z.number().int(),
});

export const ChangeSeatsSchema = z.object({
  quantity: z.number().int().min(1).max(1000),
  requestId: BillingRequestIdSchema,
});

export const ChangeSeatsResultSchema = z.object({
  changed: z.boolean(),
  operationId: z.string().optional(),
  prorationBehavior: z.enum(["always_invoice", "create_prorations"]).optional(),
  quantity: z.number().int(),
  replayed: z.boolean().optional(),
});

export const CreatePortalSessionSchema = z.object({
  returnPath: z.enum(PORTAL_RETURN_PATHS).optional(),
});

export const PortalSessionResultSchema = z.object({
  url: z.string(),
});
