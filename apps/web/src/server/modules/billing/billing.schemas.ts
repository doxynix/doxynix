import * as z from "zod";

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
