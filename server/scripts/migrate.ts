import { env } from "@server/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

console.log("Running Drizzle migrations...");

const client = postgres(env.DATABASE_URL);
const db = drizzle(client);

try {
  await migrate(db, {
    migrationsFolder: "./src/db/migrations",
  });

  console.log("✅ Migrations applied successfully!");
} finally {
  await client.end();
}
