import { z } from "zod/v4-mini";

export const CreateApiKeySchema = z.object({
  description: z.optional(z.string().check(z.trim(), z.maxLength(1000, "Description too long"))),

  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, "Name must be at least 1 character"),
      z.maxLength(50, "Name cannot exceed 50 characters")
    ),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
