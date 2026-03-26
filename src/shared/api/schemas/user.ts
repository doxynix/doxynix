import { z } from "zod/v4-mini";

export const UpdateProfileSchema = z.object({
  email: z.optional(
    z
      .string()
      .check(
        z.email("Please enter a valid email address"),
        z.maxLength(254, "Email address cannot exceed 254 characters")
      )
  ),
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, "Name must be at least 1 character"),
      z.maxLength(50, "Name cannot exceed 50 characters")
    ),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
