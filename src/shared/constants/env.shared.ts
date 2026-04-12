import { z } from "zod/v4-mini";

export const sharedSchema = {
  ANALYZE: z.optional(z.enum(["true", "false"])),
  CI: z.optional(z.enum(["true", "false"])),
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.optional(z.string()),
};

export const envShared = {
  ANALYZE: process.env.ANALYZE,
  CI: process.env.CI,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
};

export const isSharedValidationSkipped =
  process.env.SKIP_ENV_VALIDATION === "development" ||
  (process.env.CI != null && process.env.CI !== "");
