import { defineConfig } from "drizzle-kit";

import { env } from "./src/core/env";

export default defineConfig({
  breakpoints: true,
  casing: "snake_case",
  dbCredentials: {
    url: env.DIRECT_URL ?? env.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./src/core/db/migrations",
  schema: "./src/core/db/schema.ts",
  strict: true,
  verbose: true,
});
