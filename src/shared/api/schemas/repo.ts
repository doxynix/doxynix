import z from "zod";

export const GitHubQuerySchema = z.object({
  query: z.string().trim().min(2, "Min 2 chars").max(256, "Query too long"),
});

export const CreateRepoSchema = z.object({
  url: z.string().trim().min(1, "URL cannot be empty").max(500, "URL too long"),
});

export type GitHubQueryInput = z.infer<typeof GitHubQuerySchema>;
export type CreateRepoInput = z.infer<typeof CreateRepoSchema>;
