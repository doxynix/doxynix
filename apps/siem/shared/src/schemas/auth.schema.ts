import { z } from "zod";

export const authSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type AuthSchema = z.infer<typeof authSchema>;
