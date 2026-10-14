/**
 * Index drift between the application database and the benchmark clone.
 *
 * Every benchmark number is only comparable against the schema it was measured on. When the two
 * databases drift, the harness keeps reporting confidently — it just reports about a different
 * database. That happened twice during the audit that produced these docs, and both times it was
 * caught by eye rather than by a check.
 *
 * Exits 0 when either URL is unset, so wiring this into `validate` cannot break CI — where the
 * stress clone does not exist — or a local run that never exported `DATABASE_URL`.
 *
 * Usage:
 *   DATABASE_URL=postgresql://…/dxnx_web \
 *   BENCH_DATABASE_URL=postgresql://…/dxnx_web_stress \
 *     bun run check:index-parity
 */
import pg from "pg";

const { Client } = pg;

// Scratch tables from earlier analysis sessions (`_idx_snapshot`, `_qtext`, `_rmap`, …) live only
// in the clone. They are not part of the schema, so counting them as drift would train the check
// to be ignored.
const SQL = `
  SELECT c.relname AS table_name, i.relname AS index_name, pg_get_indexdef(x.indexrelid) AS definition
  FROM pg_index x
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname NOT LIKE '\\_%'
  ORDER BY c.relname, i.relname
`;

type Row = { definition: string; index_name: string; table_name: string };

async function readIndexes(url: string, label: string): Promise<Map<string, Row>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<Row>(SQL);
    const db = await client.query<{ n: string }>("SELECT current_database() AS n");
    console.log(`  ${label.padEnd(10)} ${db.rows[0]?.n.padEnd(18)} ${rows.length} indexes`);
    return new Map(rows.map((r) => [`${r.table_name}.${r.index_name}`, r]));
  } finally {
    await client.end();
  }
}

async function main() {
  const appUrl = process.env.DATABASE_URL;
  const benchUrl = process.env.BENCH_DATABASE_URL;

  if (appUrl == null || benchUrl == null) {
    const missing = appUrl == null ? "DATABASE_URL" : "BENCH_DATABASE_URL";
    console.log(`  ${missing} не задан — проверка дрейфа индексов пропущена.`);
    return;
  }

  console.log("\n── индексы ──");
  const app = await readIndexes(appUrl, "app");
  const bench = await readIndexes(benchUrl, "bench");

  const onlyInApp = [...app.keys()].filter((k) => !bench.has(k)).sort();
  const onlyInBench = [...bench.keys()].filter((k) => !app.has(k)).sort();

  // A definition can differ while both names exist — a renamed column, a changed sort order.
  // Same name, different definition is drift too and is easy to miss by comparing names alone.
  const redefined = [...app.keys()]
    .filter((k) => bench.has(k) && bench.get(k)?.definition !== app.get(k)?.definition)
    .sort();

  const total = onlyInApp.length + onlyInBench.length + redefined.length;
  if (total === 0) {
    console.log("\n  ✔ наборы индексов совпадают\n");
    return;
  }

  for (const key of onlyInApp) {
    console.log(`  только в app:   ${key}`);
  }
  for (const key of onlyInBench) {
    console.log(`  только в bench: ${key}`);
  }
  for (const key of redefined) {
    console.log(`  определение разошлось: ${key}`);
    console.log(`    app:   ${app.get(key)?.definition}`);
    console.log(`    bench: ${bench.get(key)?.definition}`);
  }
  console.log(`\n  ✖ расхождений: ${total}. Примени миграции к обеим базам.\n`);
  process.exitCode = 1;
}

await main();
