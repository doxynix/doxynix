import * as z from "zod/mini";

export function createMagicLinkSchema(invalidEmailError: string, emailTooLongError: string) {
  return z.object({
    email: z
      .email({
        error: invalidEmailError,
      })
      .check(
        z.maxLength(254, {
          error: emailTooLongError,
        }),
      ),
  });
}

export type MagicLinkSchemaValue = z.infer<ReturnType<typeof createMagicLinkSchema>>;
