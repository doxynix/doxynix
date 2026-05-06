import { z } from "zod";

export const UpdateProfileSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(254, "Email address cannot exceed 254 characters")
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name must be at least 1 character")
    .max(50, "Name cannot exceed 50 characters"),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
