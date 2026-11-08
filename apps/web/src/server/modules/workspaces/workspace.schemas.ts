import { PlanCodeSchema, WorkspaceRole } from "@doxynix/shared";
import * as z from "zod";

export const WorkspaceEntitlementSummarySchema = z.object({
  aiTokensPerMonth: z.number().int().nullable(),
  analysesPerMonth: z.number().int().nullable(),
  autoResync: z.boolean(),
  historyDays: z.number().int().nullable(),
  planCode: PlanCodeSchema,
  privateReposAllowed: z.boolean(),
  prReviews: z.boolean(),
  reposLimit: z.number().int().nullable(),
  seatLimit: z.number().int(),
});

export const WorkspaceSummarySchema = z.object({
  entitlement: WorkspaceEntitlementSummarySchema.nullable(),
  id: z.uuid(),
  name: z.string(),
  role: z.enum(WorkspaceRole),
});

export const WorkspaceMemberSummarySchema = z.object({
  id: z.uuid(),
  role: z.enum(WorkspaceRole),
  user: z.object({
    id: z.uuid(),
    image: z.string().nullable(),
    name: z.string().nullable(),
  }),
  userId: z.uuid(),
});

export const AddWorkspaceMemberSchema = z.object({
  email: z.email(),
});

export const RemoveWorkspaceMemberSchema = z.object({
  userId: z.uuid(),
});

export const SeatAdditionPreviewSchema = z.object({
  amountPerSeatCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  needsCharge: z.boolean(),
  periodEnd: z.date().nullable(),
  quantity: z.number().int(),
});

export const SwitchWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
});

export const WorkspaceInviteTokenSchema = z.object({
  token: z.string().trim().min(1).max(200),
});

export const WorkspaceInvitePreviewSchema = z.object({
  valid: z.boolean(),
  workspaceName: z.string().nullable(),
});

export const WorkspaceInviteCreatedSchema = z.object({
  emailSent: z.boolean(),
  expiresAt: z.date(),
  token: z.string(),
});

export const CreateWorkspaceInviteSchema = z.object({
  email: z.email().optional(),
});

export const WorkspaceInviteAcceptedSchema = z.object({
  workspaceId: z.uuid(),
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
