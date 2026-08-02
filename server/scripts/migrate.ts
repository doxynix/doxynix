import { neon } from "@neondatabase/serverless";
import { env } from "@server/env";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

console.log("Running Drizzle migrations...");

const sql = neon(env.DIRECT_URL ?? env.DATABASE_URL);
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("✅ Migrations applied successfully!");
  process.exit(0);
} catch (error) {
  console.error("❌ Migration failed with error:\n", error);
  process.exit(1);
}
