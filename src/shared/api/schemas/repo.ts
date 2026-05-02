import { z } from "zod/v4-mini";

export const GitHubQuerySchema = z.object({
  query: z
    .string()
    .check(z.trim(), z.minLength(2, "Min 2 chars"), z.maxLength(256, "Query too long")),
});

export const CreateRepoSchema = z.object({
  url: z
    .string()
    .check(z.trim(), z.minLength(1, "URL cannot be empty"), z.maxLength(500, "URL too long")),
});

export type CreateRepoInput = z.infer<typeof CreateRepoSchema>;
