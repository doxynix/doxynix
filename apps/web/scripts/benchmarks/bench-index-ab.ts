/**
 * Does an index earn its write cost on this database?
 *
 * `idx_scan` cannot answer that: on a clone it means "not exercised", and in production it needs
 * weeks of observation. The only honest local answer is to time the query with the index and
 * without it, on this data, and compare.
 *
 * The index is dropped and recreated on every run, so the end state is identical to the start —
 * except that a recreated index is not byte-identical in physical order, which is why the
 * measurement repeats after restoring as well.
 *
 * Usage:
 *   DATABASE_URL=postgresql://…/dxnx_web_stress bun run bench:index-ab <label>=<sql> …
 *   DATABASE_URL=… bun run bench:index-ab \
 *     'users page 1=SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20' \
 *     --index users_created_at_id_idx
 *
 * The `--index` flag is shared by every label in one run, so pass the same index name once per
 * group. Bench it on the clone only: never on a database whose contents matter.
 */
import pg from "pg";

const { Client } = pg;

const RUNS = Number(process.env.AB_RUNS ?? 7);

type Case = { label: string; sql: string };

const argv = process.argv.slice(2);
const indexName = (() => {
  const at = argv.indexOf("--index");
  return at === -1 ? "" : (argv[at + 1] ?? "");
})();

/** `--key name=SELECT …` — resolved once, then substituted as a quoted literal into every case. */
const keyArgs = argv.filter((a, i) => argv[i - 1] === "--key");

const cases: Case[] = argv
  .filter((a, i) => !keyArgs.includes(a) && argv[i - 1] !== "--key")
  .filter((a) => a !== "--index" && a !== "--key" && a !== indexName)
  .flatMap((arg) => {
    const eq = arg.indexOf("=");
    return eq === -1 ? [] : [{ label: arg.slice(0, eq), sql: arg.slice(eq + 1) }];
  });

async function resolveKeys(client: Client): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  for (const arg of keyArgs) {
    const eq = arg.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = arg.slice(0, eq);
    const result = await client.query<{ k: string }>(arg.slice(eq + 1));
    keys.set(name, (result.rows[0]?.k ?? "").replaceAll("'", "''"));
  }
  return keys;
}

function fillKeys(sql: string, keys: Map<string, string>): string {
  let out = sql;
  // Longest first, so `@user` does not eat the prefix of `@userId`.
  for (const [name, value] of [...keys].sort((a, b) => b[0].length - a[0].length)) {
    out = out.replaceAll(`@${name}`, value);
  }
  return out;
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
  const r = (n: number) => Number(n.toFixed(2));
  return { max: r(sorted.at(-1) ?? 0), median: r(at(50)), min: r(sorted[0] ?? 0), p95: r(at(95)) };
}

async function time(client: Client, sql: string) {
  const samples: number[] = [];
  for (let i = 0; i < RUNS + 1; i++) {
    const t0 = performance.now();
    await client.query(sql);
    const ms = performance.now() - t0;
    // First run warms the cache and is discarded: the point is steady-state cost either way.
    if (i > 0) {
      samples.push(ms);
    }
  }
  return stats(samples);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (url == null) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  if (cases.length === 0) {
    console.error("pass at least one label=sql argument");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  // Resolved before anything is timed. A key picked with a `GROUP BY … ORDER BY count(*)` inline in
  // the WHERE clause is re-executed on every sample and costs far more than the query under test
  // — which silently swamps the comparison this script exists to make.
  const keys = await resolveKeys(client);
  const timed: Case[] = cases.map((c) => ({ label: c.label, sql: fillKeys(c.sql, keys) }));

  if (keys.size > 0) {
    console.log(`  keys resolved: ${[...keys.keys()].join(", ")}`);
  }

  if (indexName === "") {
    console.log("no --index given: timing only, nothing to compare");
    for (const c of timed) {
      console.log(`${c.label.padEnd(34)} ${JSON.stringify(await time(client, c.sql))}`);
    }
    await client.end();
    return;
  }

  const def = await client.query<{ d: string }>(
    `SELECT indexdef AS d FROM pg_indexes WHERE indexname = $1`,
    [indexName],
  );
  const createSql = def.rows[0]?.d;
  if (createSql == null) {
    console.error(`index "${indexName}" not found in this database`);
    process.exit(1);
  }

  console.log(`\n  index: ${indexName}`);
  console.log(`  runs:  ${RUNS} (plus one discarded warm-up) per state\n`);

  const rows: string[] = [];
  for (const c of timed) {
    await time(client, c.sql);

    await client.query(`DROP INDEX "${indexName}"`);
    let withoutIndex;
    try {
      withoutIndex = await time(client, c.sql);
    } finally {
      await client.query(createSql);
    }
    // A recreated index is in arbitrary physical order until it is vacuumed, so the number taken
    // *after* restoring is the honest one. Comparing the pre-drop timing against the un-indexed
    // timing is not: the drop/recreate cycle churns the cache, and the pre-drop timing belongs to
    // an index that no longer exists.
    const restored = await time(client, c.sql);

    const delta = withoutIndex.median - restored.median;
    const ratio = withoutIndex.median / Math.max(restored.median, 0.001);
    const verdict = delta < 0.2 ? "no benefit" : `${ratio.toFixed(1)}x faster`;

    rows.push(
      `${c.label.padEnd(34)}${restored.median.toFixed(2).padStart(9)}${restored.p95
        .toFixed(2)
        .padStart(9)}${withoutIndex.median.toFixed(2).padStart(11)}${withoutIndex.p95
        .toFixed(2)
        .padStart(11)}${verdict.padStart(14)}`,
    );
  }

  console.log(
    `${"query".padEnd(34)}${"with p50".padStart(9)}${"with p95".padStart(9)}${"without p50".padStart(11)}${"without p95".padStart(11)}${"verdict".padStart(14)}`,
  );
  console.log("─".repeat(88));
  console.log(rows.join("\n"));
  console.log("\n  ms. Index dropped and recreated for every measurement; final state matches.\n");

  await client.end();
}

await main();
