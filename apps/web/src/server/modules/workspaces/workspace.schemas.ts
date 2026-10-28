import { WorkspaceRole } from "@doxynix/shared";
import * as z from "zod";

export const PLAN_CODES = ["HOBBY", "PRO", "TEAM"] as const;

export const PlanCodeSchema = z.enum(PLAN_CODES);

export const PRO_ENTITLEMENT = {
  aiTokensPerMonth: 20_000_000,
  analysesPerMonth: 500,
  autoResync: true,
  historyDays: 90,
  planCode: "PRO",
  privateReposAllowed: true,
  prReviews: true,
  reposLimit: null,
} as const;

export const WorkspaceEntitlementSummarySchema = z.object({
  aiTokensPerMonth: z.number().int().nullable(),
  analysesPerMonth: z.number().int().nullable(),
  autoResync: z.boolean(),
  historyDays: z.number().int().nullable(),
  planCode: z.string(),
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

export const SwitchWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;
