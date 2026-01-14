import { z } from "zod";

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Слишком короткое имя (мин 1 символ)")
    .max(50, "Слишком длинное название (макс 50)"),
  description: z.string().trim().max(1000, "Слишком длинное описание").optional(),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
