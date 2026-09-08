import { createInsertSchema } from "drizzle-zod";
import * as z from "zod";

import { paginationQuerySchema } from "@/core/db/pagination";
import { rules, selectRuleSchema } from "@/core/db/schema";

function isValidRegex(pattern: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex instanceof RegExp;
  } catch {
    return false;
  }
}

export const getRulesQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(255, "Search query too long").optional(),
  severity: selectRuleSchema.shape.severity.optional(),
});

export const createRuleSchema = createInsertSchema(rules, {
  description: (schema) => schema.min(5).max(1000),
  name: (schema) => schema.min(3).max(100),
  pattern: (schema) => schema.min(1).max(2000).refine(isValidRegex, "Invalid regex"),
}).omit({ createdAt: true, id: true });

export const updateRuleSchema = createRuleSchema.partial();

export const ruleParamsSchema = z.object({
  id: z.uuid("Invalid rule ID format"),
});

export type GetRulesQuery = z.infer<typeof getRulesQuerySchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type RuleParams = z.infer<typeof ruleParamsSchema>;
