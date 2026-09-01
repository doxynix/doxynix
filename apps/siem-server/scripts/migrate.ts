import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "@/core/env";

console.log("Running Drizzle migrations with postgres-js...");

const client = postgres(env.DIRECT_URL ?? env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./src/core/db/migrations" });
  console.log("✅ Migrations applied successfully!");
  await client.end();
  process.exit(0);
} catch (error) {
  console.error("❌ Migration failed with error:\n", error);
  await client.end();
  process.exit(1);
}
