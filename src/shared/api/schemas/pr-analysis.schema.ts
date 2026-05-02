import { z } from "zod";

import { PRCommentStyleSchema, PRFocusAreaSchema } from "@/generated/zod";

export const PRAnalysisConfigSchema = z.object({
  ciSkip: z.boolean().default(false),
  commentStyle: PRCommentStyleSchema.default(PRCommentStyleSchema.enum.DETAILED),
  enabled: z.boolean().default(false),
  excludePatterns: z.array(z.string()).default([]),
  focusAreas: z
    .array(PRFocusAreaSchema)
    .default([PRFocusAreaSchema.enum.SECURITY, PRFocusAreaSchema.enum.PERFORMANCE]),
  tokenBudget: z.number().int().min(10_000).max(100_000).default(30_000),
});

export type PRAnalysisConfig = z.infer<typeof PRAnalysisConfigSchema>;

export const UpdatePRConfigInput = z.object({
  ciSkip: z.boolean().optional(),
  commentStyle: PRCommentStyleSchema.optional(),
  enabled: z.boolean().optional(),
  focusAreas: z.array(PRFocusAreaSchema).optional(),
  repoId: z.string(),
  tokenBudget: z.number().int().min(10_000).max(100_000).optional(),
});

export type UpdatePRConfigInputValues = z.infer<typeof UpdatePRConfigInput>;

export const PRFindingSchema = z.object({
  codeSnippet: z.string().optional(),
  file: z.string(),
  line: z.number().int().positive(),
  message: z.string(),
  severity: z.number().int().min(0).max(10),
  suggestion: z.string().optional(),
  title: z.string(),
  type: z.enum(["security", "performance", "complexity", "style", "bug", "architecture"]),
});

export const ApplyFixInput = z.object({
  fixId: z.number(),
});

export const CreateFixInput = z.object({
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number(),
      suggestion: z.string().optional(),
      type: z.string(),
    })
  ),
  prAnalysisId: z.number().optional(),
  repoId: z.number(),
});
