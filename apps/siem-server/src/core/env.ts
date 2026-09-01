import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  runtimeEnv: process.env,
  server: {
    AXIOM_DATASET: z.string().min(1),
    AXIOM_TOKEN: z.string().min(1),
    BETTER_AUTH_URL: z.url().default("http://localhost:8080"),
    CLIENT_URL: z
      .string()
      .optional()
      .default(
        "http://localhost:3001,https://localhost:3001,http://127.0.0.1:3001,https://127.0.0.1:3001",
      )
      .transform((val) => val.split(",").map((url) => url.trim().replace(/\/$/, "")))
      .pipe(z.array(z.url()).min(1)),
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url().optional(),
    INITIAL_ADMIN_EMAIL: z.email().optional(),
    INITIAL_ADMIN_PASSWORD: z.string().optional(),
    NODE_ENV: z.enum(["production", "development", "test"]).default("development"),
    REDIS_URL: z.url(),
  },
  skipValidation: process.env.CI === "true",
});
