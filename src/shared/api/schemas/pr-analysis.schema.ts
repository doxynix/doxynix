import { z } from "zod";

import { PRCommentStyleSchema, PRFocusAreaSchema } from "@/shared/api-contracts";

export const UpdatePRConfigInput = z.object({
  ciSkip: z.boolean().optional(),
  commentStyle: PRCommentStyleSchema.optional(),
  enabled: z.boolean().optional(),
  focusAreas: z.array(PRFocusAreaSchema).optional(),
  repoId: z.string(),
  tokenBudget: z.number().int().min(10_000).max(100_000).optional(),
});

export type UpdatePRConfigInputValues = z.infer<typeof UpdatePRConfigInput>;
