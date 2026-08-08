import { z } from "zod";

export const createPrSchema = z.object({
  branchName: z
    .string()
    .min(1, "Branch name is required")
    .regex(/^[\w./-]+$/, "Invalid branch name format"),
  prTitle: z
    .string()
    .min(5, "PR title must be at least 5 characters")
    .max(100, "Title is too long"),
});

export type CreatePrValues = z.infer<typeof createPrSchema>;
