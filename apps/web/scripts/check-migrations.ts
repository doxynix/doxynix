/**
 * Fails when the database is behind the migrations committed in this repository.
 *
 * The failure this prevents: a deploy reaches production while the schema it was built
 * against is not the schema the database has, so every query against a new column
 * fails at runtime. Catching that at build time is much cheaper than discovering it
 * from user-visible errors.
 *
 * The check is read-only: it compares the `_prisma_migrations` bookkeeping table with
 * the `prisma/migrations` directory and never writes to the database.
 *
 * It is enforced on production builds (`VERCEL_ENV=production`) and can be forced
 * anywhere with `REQUIRE_MIGRATIONS=true`. Local and CI runs only report, because the
 * CI database is created with `prisma db push` and therefore has no migration history
 * to compare against.
 *
 * Usage:
 *   DATABASE_URL=postgresql://…/dxnx_web bun run db:check-migrations
 *   DATABASE_URL=… MIGRATION_WAIT_SECONDS=180 bun run db:check-migrations
 */
import { readdirSync } from "node:fs";

import { join } from "pathe";
import pg from "pg";

const { Client } = pg;

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "prisma", "migrations");

const IS_ENFORCED =
  process.env.REQUIRE_MIGRATIONS === "true" || process.env.VERCEL_ENV === "production";

// The migration workflow and the deploy build start at the same time on a push to
// main, so the build can win the race and observe an unmigrated database that is
// about to be migrated. Waiting turns that race into a short delay instead of a
// failed deploy. The wait only applies to an enforced run.
const WAIT_SECONDS = Number(
  process.env.MIGRATION_WAIT_SECONDS ?? (process.env.VERCEL_ENV === "production" ? "180" : "0"),
);
const POLL_INTERVAL_MS = 10_000;

export function localMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

export function findPendingMigrations(
  local: readonly string[],
  applied: ReadonlySet<string>,
): string[] {
  return local.filter((name) => !applied.has(name));
}

export async function appliedMigrations(databaseUrl: string): Promise<Set<string>> {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const result = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );

    return new Set(result.rows.map((row) => row.migration_name));
  } finally {
    await client.end();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl == null || databaseUrl.trim() === "") {
    if (IS_ENFORCED) {
      console.error("db:check-migrations: DATABASE_URL is not set");
      return 1;
    }

    console.log("db:check-migrations: DATABASE_URL is not set, skipping");
    return 0;
  }

  const local = localMigrations();

  let applied: Set<string>;
  try {
    applied = await appliedMigrations(databaseUrl);
  } catch (error) {
    // A database created with `prisma db push` has no migration history at all, so there
    // is nothing to compare against. Only an enforced run can treat that as a failure.
    if (!IS_ENFORCED) {
      console.log(
        `db:check-migrations: no migration history in this database, skipping (${(error as Error).message})`,
      );
      return 0;
    }

    console.error(`db:check-migrations: could not read the migration history`);
    console.error(`db:check-migrations: ${(error as Error).message}`);
    return 1;
  }

  let pending = findPendingMigrations(local, applied);

  if (pending.length > 0 && IS_ENFORCED && WAIT_SECONDS > 0) {
    console.log(
      `db:check-migrations: ${pending.length} migration(s) pending, waiting up to ${WAIT_SECONDS}s for them to be applied`,
    );

    const deadline = Date.now() + WAIT_SECONDS * 1000;
    while (pending.length > 0 && Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      pending = findPendingMigrations(local, await appliedMigrations(databaseUrl));
    }
  }

  if (pending.length === 0) {
    console.log(`db:check-migrations: all ${local.length} migration(s) are applied`);
    return 0;
  }

  if (!IS_ENFORCED) {
    console.log(
      `db:check-migrations: ${pending.length} migration(s) are not applied (not enforced outside production)`,
    );
    return 0;
  }

  console.error(
    `db:check-migrations: ${pending.length} migration(s) are committed but not applied to the database:`,
  );
  for (const name of pending) {
    console.error(`  ${name}`);
  }
  console.error("db:check-migrations: run `bun run db:migrate-prod` before deploying");
  return 1;
}

if (import.meta.main) {
  process.exitCode = await main();
}
