import { SEVERITY_LEVELS } from "@doxynix/shared";
import { z } from "zod";

import { paginationQuerySchema } from "@/core/db/pagination";
import { selectRuleSchema } from "@/core/db/schema";

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

export const createRuleSchema = z.object({
  description: z
    .string()
    .min(5, "Description must be at least 5 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  isActive: z.boolean().optional().default(true),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  pattern: z
    .string()
    .min(1, "Pattern cannot be empty")
    .max(2000, "Pattern regular expression is too long")
    .refine(isValidRegex, { message: "Invalid regular expression pattern" }),
  severity: z.enum(SEVERITY_LEVELS),
});

export const updateRuleSchema = createRuleSchema.partial();

export const ruleParamsSchema = z.object({
  id: z.uuid("Invalid rule ID format"),
});

export type GetRulesQuery = z.infer<typeof getRulesQuerySchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type RuleParams = z.infer<typeof ruleParamsSchema>;
