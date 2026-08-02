import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url().optional(),
    AXIOM_TOKEN: z.string().min(1),
    NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: process.env.CI === "true",
});
