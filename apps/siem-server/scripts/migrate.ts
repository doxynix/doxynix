import { SQL } from "bun";

import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { env } from "@/core/env";

console.log("Running Drizzle migrations with Bun.SQL...");

const client = new SQL(env.DIRECT_URL ?? env.DATABASE_URL, { max: 1 });
const db = drizzle({ client });

try {
  await migrate(db, { migrationsFolder: "./src/core/db/migrations" });
  console.log("✅ Migrations applied successfully!");
  await client.close();
  process.exit(0);
} catch (error) {
  console.error("❌ Migration failed with error:\n", error);
  await client.close();
  process.exit(1);
}
