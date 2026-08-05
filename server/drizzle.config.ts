import { defineConfig } from "drizzle-kit";
import { env } from "./src/core/env";

export default defineConfig({
  schema: "./src/core/db/schema.ts",
  out: "./src/core/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DIRECT_URL ?? env.DATABASE_URL,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
  breakpoints: true,
});
