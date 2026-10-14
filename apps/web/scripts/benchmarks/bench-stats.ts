/**
 * What the server actually ran. `bench:queries` measures shapes we chose; this reports what
 * really executed, which is the only one of the four layers that cannot be wrong about the
 * query set. In production it is also the input to `pg_stat_statements_reset()` plus a wait
 * window, since the counters accumulate rather than sample.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:123456@localhost:5432/dxnx_web_stress bun run bench:stats // secretlint-disable-line -- compose.yml dev credentials
 *
 * Options (env):
 *   STATS_LIMIT=25   rows per section, default 25
 *   STATS_RESET=1    reset the counters first, so the next run reports only its own workload
 */
import pg from "pg";

const { Client } = pg;

const LIMIT = Number(process.env.STATS_LIMIT ?? 25);
const RESET = process.env.STATS_RESET === "1";

type Section = { label: string; note: string; sql: string };

const SECTIONS: Section[] = [
  {
    label: "Total cost",
    note: "A query with a small mean but huge call count is the one that actually costs the cluster.",
    sql: `SELECT calls,
                 round(mean_exec_time::numeric, 2) AS mean_ms,
                 round(total_exec_time::numeric)     AS total_ms,
                 left(regexp_replace(query, '\\s+', ' ', 'g'), 90) AS query
          FROM pg_stat_statements
          ORDER BY total_exec_time DESC
          LIMIT ${LIMIT}`,
  },
  {
    label: "Mean cost",
    note: "Catches a single statement that is slow regardless of how often it runs.",
    sql: `SELECT calls,
                 round(mean_exec_time::numeric, 2) AS mean_ms,
                 left(regexp_replace(query, '\\s+', ' ', 'g'), 90) AS query
          FROM pg_stat_statements
          ORDER BY mean_exec_time DESC
          LIMIT ${LIMIT}`,
  },
  {
    // On the synthetic clone this proves nothing: an index nobody exercised reads zero. In
    // production, over weeks, a zero here is the only evidence that an index is dead.
    label: "Indexes never chosen",
    note: "Zero means 'not exercised' on a clone. Only production evidence justifies a drop.",
    sql: `SELECT relname, indexrelname, idx_scan
          FROM pg_stat_user_indexes
          WHERE idx_scan = 0
          ORDER BY relname, indexrelname`,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (url == null) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const probe = await client.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM pg_stat_statements",
  );
  const recorded = Number(probe.rows[0]?.n ?? 0);
  if (recorded === 0) {
    console.error(
      "\n  pg_stat_statements is loaded but empty. Generate a workload first:\n" +
        "    DATABASE_URL=… bun run bench:queries\n",
    );
    await client.end();
    process.exit(1);
  }

  const info = await client.query<{ db: string; v: string }>(
    "SELECT current_database() AS db, version() AS v",
  );
  console.log(`\n  db: ${info.rows[0]?.db}   statements recorded: ${recorded}`);
  console.log(`  ${(info.rows[0]?.v ?? "").split(" on ")[0]}\n`);

  if (RESET) {
    await client.query("SELECT pg_stat_statements_reset()");
    console.log("  counters reset — run the workload again to attribute it\n");
    await client.end();
    return;
  }

  for (const section of SECTIONS) {
    const result = await client.query<Record<string, string | number>>(section.sql);
    console.log(`── ${section.label} ${"─".repeat(Math.max(0, 60 - section.label.length))}`);
    console.log(`   ${section.note}\n`);
    if (result.rows.length === 0) {
      console.log("   (пусто)\n");
      continue;
    }
    console.log(result.rows.map((r) => JSON.stringify(r)).join("\n"));
    console.log("");
  }

  await client.end();
}

await main();
