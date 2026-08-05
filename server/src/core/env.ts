import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_URL: z.url().default("http://localhost:8080"),
    REDIS_URL: z.url(),
    DIRECT_URL: z.url().optional(),
    AXIOM_TOKEN: z.string().min(1),
    AXIOM_DATASET: z.string().min(1),
    CLIENT_URL: z
      .string()
      .optional()
      .default("http://localhost:3000,https://localhost:3000")
      .transform((val) => val.split(",").map((url) => url.trim().replace(/\/$/, "")))
      .pipe(z.array(z.url()).min(1)),
    NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: process.env.CI === "true",
});
