import * as z from "zod";

/**
 * Workspace commerce plan. Stored as text in the database on purpose: adding a plan must not
 * require an enum migration, and an unknown value must not break writes (same as Stripe statuses).
 */
export const PLAN_CODES = ["HOBBY", "PRO", "TEAM"] as const;

export const PlanCodeSchema = z.enum(PLAN_CODES);

export type PlanCode = z.infer<typeof PlanCodeSchema>;

export const PlanCode = {
  HOBBY: "HOBBY",
  PRO: "PRO",
  TEAM: "TEAM",
} as const satisfies Record<string, PlanCode>;
