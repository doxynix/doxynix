import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    AXIOM_TOKEN: z.string().min(1),
    NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  },
  runtimeEnv: process.env,
});
