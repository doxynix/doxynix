import * as z from "zod/v4/core";

export function validateField(schema: z.$ZodType) {
  return (value: unknown): string | undefined => {
    const result = z.safeParse(schema, value);

    if (!result.success) {
      return result.error.issues[0]?.message ?? "Invalid value";
    }

    return undefined;
  };
}
