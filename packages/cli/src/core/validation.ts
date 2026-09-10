import * as z from "zod/mini";

export function validateField(schema: z.ZodMiniType) {
  return (value: unknown): string | undefined => {
    const result = z.safeParse(schema, value);

    if (!result.success) {
      return result.error.issues[0]?.message ?? "Invalid value";
    }

    return undefined;
  };
}
