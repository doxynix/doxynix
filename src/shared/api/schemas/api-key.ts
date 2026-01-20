import { z } from "zod";

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name must be at least 1 character")
    .max(50, "Name cannot exceed 50 characters"),
  description: z.string().trim().max(1000, "Description too long").optional(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
