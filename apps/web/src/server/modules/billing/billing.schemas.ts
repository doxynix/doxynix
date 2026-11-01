import { BillingIssueSeverity, BillingIssueStatus, PlanCodeSchema } from "@doxynix/shared";
import * as z from "zod";

import { ACCESS_STATES } from "@/server/core/entitlements/state";

import { PORTAL_RETURN_PATHS } from "./billing.constants";

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

export const BillingEntitlementSummarySchema = z.object({
  accessState: z.enum(ACCESS_STATES),
  aiTokensPerMonth: z.number().int().nullable(),
  analysesPerMonth: z.number().int().nullable(),
  graceEndsAt: z.date().nullable(),
  planCode: PlanCodeSchema,
  seatLimit: z.number().int(),
  usedAnalyses: z.number().int(),
  usedTokens: z.number().int(),
});

export const BillingSubscriptionSummarySchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.date(),
  quantity: z.number().int(),
  status: z.string(),
});

// Both roles read this: MEMBER sees the plan, seats, usage and renewal date, while every mutation
// stays on ownerProcedure.
export const BillingStateSchema = z.object({
  activeMembers: z.number().int().min(0),
  entitlement: BillingEntitlementSummarySchema.nullable(),
  subscription: BillingSubscriptionSummarySchema.nullable(),
});

export type BillingState = z.infer<typeof BillingStateSchema>;

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
  requestId: z.uuid(),
  returnPath: z.enum(PORTAL_RETURN_PATHS).optional(),
});

export const PortalSessionResultSchema = z.object({
  url: z.string(),
});

export const ReplayEventSchema = z.object({
  billingEventId: z.uuid(),
});

export const ReplayEventResultSchema = z.object({
  runId: z.string(),
});

export const ResolveIssueSchema = z.object({
  issueId: z.uuid(),
  note: z.string().trim().max(500).optional(),
});

export const ResolveIssueResultSchema = z.object({
  resolved: z.boolean(),
});

export const ListIssuesSchema = z.object({
  cursor: z.uuid().optional(),
  severity: z.enum(BillingIssueSeverity).optional(),
  status: z.enum(BillingIssueStatus).optional(),
});

export const BillingIssueSummarySchema = z.object({
  details: z.unknown(),
  externalObjectId: z.string().nullable(),
  firstSeenAt: z.date(),
  id: z.uuid(),
  kind: z.string(),
  lastSeenAt: z.date(),
  resolvedAt: z.date().nullable(),
  severity: z.string(),
  source: z.string(),
  status: z.string(),
  workspaceId: z.uuid().nullable(),
});

export const ListIssuesResultSchema = z.object({
  items: z.array(BillingIssueSummarySchema),
  nextCursor: z.string().nullable(),
});
