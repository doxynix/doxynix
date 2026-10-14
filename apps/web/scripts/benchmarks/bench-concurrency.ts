/**
 * Concurrency benchmark. The whole audit so far was single-session, which measures nothing
 * about lock waits, pool pressure or write contention. This drives real parallel writers and
 * measures reader latency while they run.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:123456@localhost:5432/dxnx_web_stress \ // secretlint-disable-line -- compose.yml dev credentials
 *     bun run scripts/bench-concurrency.ts
 *
 * Options (env):
 *   CONC_WRITERS=8      concurrent writer clients
 *   CONC_READERS=8      concurrent reader clients
 *   CONC_SECONDS=20     how long to sustain the load
 *   CONC_BATCH=200      rows per writer transaction
 *   CONC_SKIP=60        reader iterations between samples
 */
import pg from "pg";

import { benchStats } from "./bench-lib";

const { Client } = pg;

const WRITERS = Number(process.env.CONC_WRITERS ?? 8);
const READERS = Number(process.env.CONC_READERS ?? 8);
const SECONDS = Number(process.env.CONC_SECONDS ?? 20);
const BATCH = Number(process.env.CONC_BATCH ?? 200);
const SKIP = Number(process.env.CONC_SKIP ?? 60);
/**
 * `audit` reproduces the original harness and keeps the recorded baseline comparable.
 * `notification` is the realistic write: `db.ts:159` doubles every mutation with an audit row,
 * so this is two statements per notification and it exercises the GIN trigram indexes the real
 * app pays to maintain.
 */
const WRITE_MODE =
  process.env.CONC_WRITE === "notification" || process.env.CONC_WRITE === "transaction"
    ? process.env.CONC_WRITE
    : "audit";
/** Marks harness-created notifications so cleanup finds them without a schema change. */
const TAG = "Conc harness";
/** The five doc types `analysis-lifecycle` upserts in one transaction. */
const DOC_TYPES = ["README", "API", "CONTRIBUTING", "CHANGELOG", "ARCHITECTURE"] as const;
/** `version` used by the transaction mode; every harness document carries it so cleanup is exact. */
const BENCH_VERSION = "bench-version";
/**
 * Audit rows carry this marker in their payload. Cleaning up by `model` alone is not safe: the
 * stress fixture legitimately contains `model = 'Notification'` rows from its own seed, and the
 * first version of this harness deleted by model and leaked 33 400 rows into it.
 */
const HARNESS_MARK = { bench: "conc" } as const;

const HOT = {
  auditActor: "",
  hotAnalysis: "",
  hotRepo: "",
  notificationsUser: "",
  prAnalysisRepo: "",
  reposUser: "",
};

const READ_SHAPES: { label: string; sql: string }[] = [
  {
    label: "notifications page1 + JOIN",
    sql: (u) =>
      `SELECT n.id,n.title,r.name FROM notifications n LEFT JOIN repos r ON r.id=n.repo_id
       WHERE n.user_id='${u}' ORDER BY n.created_at DESC, n.id DESC LIMIT 20`,
  },
  {
    label: "notifications deep page",
    sql: (u) =>
      `SELECT n.id FROM notifications n WHERE n.user_id='${u}'
       ORDER BY n.created_at DESC, n.id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    label: "audit page1",
    sql: () => `SELECT id FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    label: "audit count capped",
    sql: () => `SELECT count(*) FROM (SELECT 1 FROM audit_logs LIMIT 2000) z`,
  },
  {
    label: "repos per-user list",
    sql: (u) =>
      `SELECT id FROM repos WHERE user_id='${u}' ORDER BY updated_at DESC, id DESC LIMIT 20`,
  },
  {
    label: "prAnalyses per-repo",
    sql: (u) =>
      `SELECT id FROM pull_request_analyses WHERE repo_id='${u}'
       ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    label: "point lookup: session by token",
    sql: () => `SELECT id FROM sessions WHERE token=(SELECT token FROM sessions LIMIT 1)`,
  },
  {
    label: "point lookup: api_key by hash",
    sql: () => `SELECT id FROM api_keys WHERE hashed_key=(SELECT hashed_key FROM api_keys LIMIT 1)`,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (url == null) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const admin = new Client({ connectionString: url });
  await admin.connect();

  const pick = async (sql: string) => {
    const result = await admin.query<{ k: string }>(sql);
    return result.rows[0]?.k ?? "";
  };
  HOT.notificationsUser = await pick(
    `SELECT user_id::text k FROM notifications GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  HOT.reposUser = await pick(
    `SELECT user_id::text k FROM repos GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  HOT.auditActor = await pick(
    `SELECT user_id::text k FROM audit_logs WHERE user_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  HOT.prAnalysisRepo = await pick(
    `SELECT repo_id::text k FROM pull_request_analyses GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  // The transaction mode needs an analysis that already carries documents, so the upserts hit the
  // conflict path rather than the insert path.
  const hot = await admin.query<{ a: string; r: string }>(
    `SELECT d.analysis_id::text a, d.repo_id::text r FROM documents d
     GROUP BY 1,2 ORDER BY count(*) DESC LIMIT 1`,
  );
  HOT.hotAnalysis = hot.rows[0]?.a ?? "";
  HOT.hotRepo = hot.rows[0]?.r ?? "";

  const baseline = await admin.query<{ a: string; n: string }>(`
    SELECT (SELECT count(*) FROM audit_logs)::text a,
           (SELECT count(*) FROM notifications)::text n
  `);
  const baselineAudit = Number(baseline.rows[0]?.a ?? 0);
  const baselineNotifications = Number(baseline.rows[0]?.n ?? 0);

  // The transaction mode overwrites two real columns on a real analysis row. Its prior values are
  // captured here because the fixture has no other copy of them and nothing else would restore it.
  const hotBefore = await admin.query<{ m: string; p: number }>(
    `SELECT message AS m, progress AS p FROM analyses WHERE id = $1`,
    [HOT.hotAnalysis],
  );

  console.log(
    `\n  writers=${WRITERS}  readers=${READERS}  seconds=${SECONDS}  batch=${BATCH}  write=${WRITE_MODE}\n`,
  );

  const stopAt = Date.now() + SECONDS * 1000;
  let rowsWritten = 0;
  const writerErrors = new Map<string, number>();
  const readerErrors = new Map<string, number>();
  const latencies: Record<string, number[]> = Object.fromEntries(
    READ_SHAPES.map((s) => [s.label, []]),
  );

  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

  async function writer(id: number) {
    const client = new Client({ connectionString: url });
    // Past `max_connections` Postgres refuses the backend and the connect itself throws 53300.
    // That is the number this harness exists to find, so it is recorded instead of thrown: an
    // unhandled rejection here killed the process at exactly the failure point.
    try {
      await client.connect();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "unknown";
      bump(writerErrors, `connect ${code}: ${(error as Error).message.slice(0, 60)}`);
      return;
    }
    try {
      while (Date.now() < stopAt) {
        try {
          await client.query("BEGIN");
          for (let i = 0; i < BATCH; i++) {
            if (WRITE_MODE === "transaction") {
              // Mirrors `analysis-lifecycle.service.ts:295-351`: one UPDATE that takes a row lock,
              // then upserts that contend on the same unique key, then a notification insert.
              // Every writer targets the same analysis, so unlike the other modes this is real
              // lock contention rather than independent inserts into disjoint space.
              await client.query(`UPDATE analyses SET progress = 100, message = $2 WHERE id = $1`, [
                HOT.hotAnalysis,
                TAG,
              ]);
              for (const docType of DOC_TYPES) {
                await client.query(
                  `INSERT INTO documents (analysis_id, content, repo_id, type, version)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT (repo_id, version, type, analysis_id)
                   DO UPDATE SET content = EXCLUDED.content`,
                  [
                    HOT.hotAnalysis,
                    "concurrency harness body",
                    HOT.hotRepo,
                    docType,
                    BENCH_VERSION,
                  ],
                );
              }
              await client.query(
                `INSERT INTO notifications (title, body, type, user_id)
                 VALUES ($1, $2, 'INFO', $3)`,
                [TAG, "concurrency harness row", HOT.notificationsUser],
              );
              rowsWritten += 7;
              continue;
            }

            if (WRITE_MODE === "notification") {
              // `db.ts` intercepts every mutation and writes an audit row for it, so a single
              // notification is two statements and the transaction is 2x the statements. Writing
              // only into audit_logs — as the original harness did — measures the cheap half and
              // never touches the notification indexes or the trigram GINs.
              await client.query(
                `INSERT INTO notifications (title, body, type, user_id)
                 VALUES ($1, $2, 'INFO', $3)`,
                [TAG, "concurrency harness row", HOT.notificationsUser],
              );
              await client.query(
                `INSERT INTO audit_logs (model, operation, payload, user_id)
                 VALUES ('Notification', 'create', $2::jsonb, $1)`,
                [HOT.notificationsUser, JSON.stringify(HARNESS_MARK)],
              );
              rowsWritten += 2;
              continue;
            }

            await client.query(
              `INSERT INTO audit_logs (model, operation, payload, user_id)
               VALUES ('Conc', 'create', $2::jsonb, $1)`,
              [HOT.auditActor, JSON.stringify(HARNESS_MARK)],
            );
            rowsWritten++;
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          const code = (error as { code?: string }).code ?? "unknown";
          bump(writerErrors, `${code}: ${(error as Error).message.slice(0, 60)}`);
        }
      }
    } finally {
      await client.end();
    }
    void id;
  }

  async function reader(id: number) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
    } catch (error) {
      const code = (error as { code?: string }).code ?? "unknown";
      bump(readerErrors, `connect ${code}: ${(error as Error).message.slice(0, 60)}`);
      return;
    }
    try {
      let i = id;
      while (Date.now() < stopAt) {
        const shape = READ_SHAPES[i % READ_SHAPES.length];
        i += 1;
        if (shape == null) {
          continue;
        }
        const user =
          shape.label.startsWith("notifications") || shape.label === "repos per-user list"
            ? shape.label === "repos per-user list"
              ? HOT.reposUser
              : HOT.notificationsUser
            : HOT.prAnalysisRepo;

        try {
          const started = performance.now();
          await client.query(shape.sql(user));
          latencies[shape.label]?.push(performance.now() - started);
        } catch (error) {
          const code = (error as { code?: string }).code ?? "unknown";
          bump(readerErrors, `${code}: ${(error as Error).message.slice(0, 60)}`);
        }

        if (SKIP > 0) {
          await new Promise((r) => setTimeout(r, 1));
        }
        i += SKIP % 7;
      }
    } finally {
      await client.end();
    }
  }

  const started = Date.now();
  await Promise.all([
    ...Array.from({ length: WRITERS }, (_, i) => writer(i)),
    ...Array.from({ length: READERS }, (_, i) => reader(i)),
  ]);
  const elapsed = (Date.now() - started) / 1000;

  console.log(`── нагрузка ${elapsed.toFixed(1)} с ──`);
  console.log(
    `   записано строк: ${rowsWritten}  (${Math.round(rowsWritten / elapsed)} строк/с)\n`,
  );
  console.log(
    `   запросов читателей: ${Object.values(latencies).reduce((a, b) => a + b.length, 0)}\n`,
  );

  console.log(
    "shape".padEnd(32) +
      "n".padStart(8) +
      "p50".padStart(9) +
      "p95".padStart(9) +
      "p99".padStart(9) +
      "max".padStart(10),
  );
  console.log("─".repeat(77));
  const rowsOut: string[] = [];
  for (const shape of READ_SHAPES) {
    const values = latencies[shape.label] ?? [];
    if (values.length === 0) {
      continue;
    }
    const s = benchStats(values);
    rowsOut.push(
      [
        shape.label.padEnd(32),
        String(s.n).padStart(8),
        s.median.toFixed(1).padStart(9),
        s.p95.toFixed(1).padStart(9),
        s.p99.toFixed(1).padStart(9),
        s.max.toFixed(1).padStart(10),
      ].join(""),
    );
  }
  console.log(rowsOut.join("\n"));

  const report = (name: string, errors: Map<string, number>) => {
    console.log(`\n${name}: ${errors.size === 0 ? "нет" : ""}`);
    for (const [msg, count] of [...errors].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`   ${count}×  ${msg}`);
    }
  };
  report("ошибки писателей", writerErrors);
  report("ошибки читателей", readerErrors);

  const tagged = await admin.query<{ a: string; n: string }>(
    `
    SELECT (SELECT count(*) FROM audit_logs WHERE payload @> $1::jsonb)::text a,
           (SELECT count(*) FROM notifications WHERE title = $2)::text n
  `,
    [JSON.stringify(HARNESS_MARK), TAG],
  );
  console.log(
    `\n── очистка: удалю ${tagged.rows[0]?.a ?? 0} строк в audit_logs ` +
      `и ${tagged.rows[0]?.n ?? 0} строк '${TAG}' в notifications ──`,
  );
  await admin.query(`DELETE FROM audit_logs WHERE payload @> $1::jsonb`, [
    JSON.stringify(HARNESS_MARK),
  ]);
  await admin.query(`DELETE FROM notifications WHERE title = $1`, [TAG]);
  if (WRITE_MODE === "transaction") {
    const restored = await admin.query(
      `UPDATE analyses SET message = $2, progress = $3 WHERE id = $1 RETURNING id`,
      [HOT.hotAnalysis, hotBefore.rows[0]?.m ?? null, hotBefore.rows[0]?.p ?? null],
    );
    const docs = await admin.query(
      `DELETE FROM documents WHERE version = $1 AND analysis_id = $2 RETURNING id`,
      [BENCH_VERSION, HOT.hotAnalysis],
    );
    console.log(
      `   восстановлен анализ: ${restored.rowCount ?? 0}, удалено документов: ${docs.rowCount ?? 0}`,
    );
  }

  // The invariant is "no harness row survives", not "the total is unchanged". The app under test
  // writes its own audit rows through `db.ts` on every mutation, so a running server legitimately
  // moves the total; asserting equality would fire on ordinary traffic and stop being a gate.
  const leftovers = await admin.query<{ a: string; n: string }>(
    `SELECT (SELECT count(*) FROM audit_logs WHERE payload @> $1::jsonb)::text a,
            (SELECT count(*) FROM notifications WHERE title = $2)::text n`,
    [JSON.stringify(HARNESS_MARK), TAG],
  );
  const leftAudit = Number(leftovers.rows[0]?.a);
  const leftNotif = Number(leftovers.rows[0]?.n);

  const final = await admin.query<{ a: string; n: string }>(`
    SELECT (SELECT count(*) FROM audit_logs)::text a,
           (SELECT count(*) FROM notifications)::text n
  `);
  const deltaAudit = Number(final.rows[0]?.a) - baselineAudit;
  const deltaNotif = Number(final.rows[0]?.n) - baselineNotifications;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  console.log(`   не удалено: ${leftAudit} в audit_logs, ${leftNotif} в notifications`);
  console.log(
    `   audit_logs:     ${baselineAudit} → ${final.rows[0]?.a} (дельта ${sign(deltaAudit)})`,
  );
  console.log(
    `   notifications: ${baselineNotifications} → ${final.rows[0]?.n} (дельта ${sign(deltaNotif)})`,
  );

  if (leftAudit !== 0 || leftNotif !== 0) {
    console.log("   ⚠ строки стенда остались — фикстура загрязнена");
    process.exitCode = 1;
  } else {
    console.log("   ✔ строк стенда не осталось");
  }
  await admin.end();
  console.log("");
}

await main();
