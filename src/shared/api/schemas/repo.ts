import z from "zod";

export const GitHubQuerySchema = z.object({
  query: z.string().trim().min(2, "Минимум 2 символа").max(256, "Запрос слишком длинный"),
});

export const CreateRepoSchema = z.object({
  url: z.string().trim().min(1, "Ссылка не может быть пустой").max(500, "Ссылка слишком длинная"),
});

export type GitHubQueryInput = z.infer<typeof GitHubQuerySchema>;
export type CreateRepoInput = z.infer<typeof CreateRepoSchema>;
