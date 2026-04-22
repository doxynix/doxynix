import { z } from "zod";

export const PRAnalysisConfigSchema = z.object({
  ciSkip: z.boolean().default(false),
  commentStyle: z.enum(["detailed", "concise", "off"]).default("detailed"),
  enabled: z.boolean().default(false),
  excludePatterns: z.array(z.string()).default(["*.test.ts", "*.spec.ts", "dist/**", "build/**"]),
  focusAreas: z
    .array(z.enum(["security", "performance", "style", "architecture"]))
    .default(["security", "performance"]),
  tokenBudget: z.number().int().min(10_000).max(100_000).default(30_000),
});

export type PRAnalysisConfig = z.infer<typeof PRAnalysisConfigSchema>;

export const CreatePRConfigInput = z.object({
  commentStyle: z.enum(["detailed", "concise", "off"]).optional(),
  enabled: z.boolean().optional(),
  focusAreas: z.array(z.enum(["security", "performance", "style", "architecture"])).optional(),
  repoId: z.number(),
  tokenBudget: z.number().int().min(10_000).max(100_000).optional(),
});

export type CreatePRConfigInput = z.infer<typeof CreatePRConfigInput>;

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

export type PRFinding = z.infer<typeof PRFindingSchema>;

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
