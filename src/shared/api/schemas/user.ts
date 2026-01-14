import z from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Имя должно быть не короче 1 символа" })
    .max(50, { message: "Имя не может быть длиннее 50 символов" }),
  email: z.email().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
