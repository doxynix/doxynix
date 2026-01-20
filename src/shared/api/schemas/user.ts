import z from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name must be at least 1 character" })
    .max(50, { message: "Name cannot exceed 50 characters" }),
  email: z.email().max(254, "Email address cannot exceed 254 characters").optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
