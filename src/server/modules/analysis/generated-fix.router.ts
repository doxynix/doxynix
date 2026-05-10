import { z } from "zod";

import { createTRPCRouter } from "@/server/core/trpc/init";
import { GeneratedFixSchema } from "@/shared/api-contracts";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const FixResultSchema = z.object({
  error: z.string().optional(),
  explanation: z.string().optional(),
  fixedFiles: z
    .array(
      z.object({
        diff: z.string().optional(),
        filePath: z.string(),
        newContent: z.string(),
      })
    )
    .optional(),
});

export const generatedFixRouter = createTRPCRouter({});

export const GeneratedFixDTO = GeneratedFixSchema.extend({ id: z.uuid() });

export const FindingForFixSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  suggestion: z.string().optional(),
  type: z.enum(["architecture", "bug", "complexity", "performance", "security", "style"]),
});

const FixedFileContentSchema = z.object({
  filePath: z.string().min(1),
  newContent: z.string().min(1),
});

export const FixApplicationPayloadSchema = z.object({
  branch: z.string().min(1),
  estimatedImpact: z.number().int().min(0).max(100),
  fixedFiles: z.array(FixedFileContentSchema).min(1),
  fixId: z.uuid(),
  repoId: z.uuid(),
  title: z.string().min(1),
});

export const GeneratedFixDetailedDTO = GeneratedFixSchema.extend({
  id: z.uuid(),
  resultJson: FixResultSchema.nullable(),
});

export const StagedFixedFileSchema = z.object({
  filePath: z.string().min(1),
  newContent: z.string().min(1),
});
