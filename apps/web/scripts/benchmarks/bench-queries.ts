/**
 * Runs every query shape the app issues, against a database of your choice, and reports the
 * median of N runs. Single-shot timings are worthless: the same query varied up to 8x between
 * runs on a cold cache, which is enough to invert a conclusion.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:123456@localhost:5432/dxnx_web_stress \ // secretlint-disable-line -- compose.yml dev credentials
 *     bun run scripts/bench-queries.ts
 *
 * Options (env):
 *   BENCH_RUNS=5      repetitions per shape, median reported (default 5)
 *   BENCH_FILTER=audit  only shapes whose label contains this
 *   BENCH_EXPLAIN=1   print the plan for each shape instead of timing it
 *   BENCH_REKEY=1     re-resolve the hot keys instead of reading the cache
 */
import pg from "pg";

import { benchStats } from "./bench-lib";

const { Client } = pg;

const HOT_KEY_CACHE = "/tmp/opencode/bench-hot-keys.json";

const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const FILTER = process.env.BENCH_FILTER?.toLowerCase();
const EXPLAIN = process.env.BENCH_EXPLAIN === "1";

type Shape = { group: string; label: string; sql: string };

/**
 * Every value the shapes filter on, resolved from the data before the loop runs. Nothing may
 * be resolved by the shape itself: a subquery in WHERE is an InitPlan re-executed on every
 * sample, so a shape that used one measured its own lookup rather than the query.
 */
const hotKeys = {
  accountsUser: "",
  analysesRepo: "",
  apiKeyHashedKey: "",
  auditUser: "",
  bannedEmailHash: "",
  chatSession: "",
  chatSessionUser: "",
  documentsRepo: "",
  generatedFixRepo: "",
  ghAccountLogin: "",
  ghInstallUser: "",
  heavyRepoUser: "",
  notificationsUser: "",
  prAnalysisRepo: "",
  prCommentAnalysis: "",
  sessionsToken: "",
  sessionsTokenHash: "",
  sessionsUser: "",
} as Record<keyof typeof hotKeys, string>;

const SHAPES: Shape[] = [
  // ---- point lookups: the paths that must stay sub-millisecond ----
  {
    group: "point",
    label: "sessions by token_hash",
    sql: `SELECT id FROM sessions WHERE token_hash='@sessionsTokenHash'`,
  },
  {
    group: "point",
    label: "api_keys by hashed_key",
    sql: `SELECT id FROM api_keys WHERE hashed_key='@apiKeyHashedKey'`,
  },
  { group: "point", label: "users by id", sql: `SELECT id FROM users LIMIT 20` },
  {
    group: "point",
    label: "repos by id (nested analyses take 1)",
    sql: `SELECT r.id,(SELECT a.id FROM analyses a WHERE a.repo_id=r.id ORDER BY a.created_at DESC LIMIT 1) FROM repos r LIMIT 20`,
  },

  // ---- paginated lists, page 1 and deepest reachable page ----
  {
    group: "list",
    label: "audit page 1",
    sql: `SELECT id FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "audit deepest page (offset 9900)",
    sql: `SELECT id FROM audit_logs ORDER BY created_at DESC, id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    group: "list",
    label: "audit filtered operation=create",
    sql: `SELECT id FROM audit_logs WHERE operation='create' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "audit date range 1 week",
    sql: `SELECT id FROM audit_logs WHERE created_at>='2026-06-01' AND created_at<'2026-06-08' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "audit search ILIKE x3 OR",
    sql: `SELECT id FROM audit_logs WHERE model ILIKE '%Analysis%' OR operation ILIKE '%create%' OR request_id ILIKE '%req%' LIMIT 20`,
  },
  {
    group: "list",
    label: "prAnalyses page 1",
    sql: `SELECT id FROM pull_request_analyses ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "prAnalyses deepest page",
    sql: `SELECT id FROM pull_request_analyses ORDER BY created_at DESC, id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    group: "list",
    label: "repos admin page 1",
    sql: `SELECT id FROM repos ORDER BY updated_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "repos admin deepest page",
    sql: `SELECT id FROM repos ORDER BY updated_at DESC, id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    group: "list",
    label: "users page 1",
    sql: `SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "list",
    label: "banned emails page 1",
    sql: `SELECT id FROM banned_emails ORDER BY created_at DESC, id DESC LIMIT 20`,
  },

  // ---- scoped lists: one user's rows, with the JOIN the real query performs ----
  {
    group: "scoped",
    label: "notifications per-user page 1 + JOIN",
    sql: `SELECT n.id,n.title,n.is_read,n.created_at,r.name,r.owner FROM notifications n LEFT JOIN repos r ON r.id=n.repo_id WHERE n.user_id='@notificationsUser' ORDER BY n.created_at DESC, n.id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "notifications per-user deepest + JOIN",
    sql: `SELECT n.id,n.title,r.name FROM notifications n LEFT JOIN repos r ON r.id=n.repo_id WHERE n.user_id='@notificationsUser' ORDER BY n.created_at DESC, n.id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    group: "scoped",
    label: "notifications per-user + type filter",
    sql: `SELECT id FROM notifications WHERE user_id='@notificationsUser' AND type='INFO' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "notifications per-user + is_read filter",
    sql: `SELECT id FROM notifications WHERE user_id='@notificationsUser' AND is_read=true ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "repos per-user (heaviest owner)",
    sql: `SELECT id FROM repos WHERE user_id='@heavyRepoUser' ORDER BY updated_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "repos per-user deepest page",
    sql: `SELECT id FROM repos WHERE user_id='@heavyRepoUser' ORDER BY updated_at DESC, id DESC OFFSET 9900 LIMIT 20`,
  },
  {
    group: "scoped",
    label: "sessions per-user (admin panel)",
    sql: `SELECT id FROM sessions WHERE user_id='@sessionsUser' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "analyses per-repo",
    sql: `SELECT id FROM analyses WHERE repo_id='@analysesRepo' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "documents per-repo",
    sql: `SELECT id FROM documents WHERE repo_id='@documentsRepo' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "chatMessages per-session (unbounded in prod)",
    sql: `SELECT id FROM chat_messages WHERE session_id='@chatSession' ORDER BY created_at ASC`,
  },
  {
    group: "scoped",
    label: "prComments per-analysis (unbounded in prod)",
    sql: `SELECT id FROM pull_request_comments WHERE analysis_id='@prCommentAnalysis' ORDER BY file_path ASC, line ASC`,
  },
  {
    group: "scoped",
    label: "prAnalyses per-repo",
    sql: `SELECT id FROM pull_request_analyses WHERE repo_id='@prAnalysisRepo' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    group: "scoped",
    label: "generatedFixes per-repo",
    sql: `SELECT id FROM generated_fixes WHERE repo_id='@generatedFixRepo' ORDER BY created_at DESC, id DESC LIMIT 20`,
  },

  // ---- counts: what the paginator actually pays for ----
  { group: "count", label: "COUNT audit unfiltered", sql: `SELECT count(*) FROM audit_logs` },
  {
    group: "count",
    label: "COUNT audit filtered operation",
    sql: `SELECT count(*) FROM audit_logs WHERE operation='create'`,
  },
  {
    group: "count",
    label: "COUNT audit date week",
    sql: `SELECT count(*) FROM audit_logs WHERE created_at>='2026-06-01' AND created_at<'2026-06-08'`,
  },
  {
    // Same table, three windows. The property under test is that cost tracks the window rather
    // than the table: 1 day must not cost a seventh of 7 days just because the row count is 1/7.
    group: "count",
    label: "COUNT audit date 1 day",
    sql: `SELECT count(*) FROM audit_logs WHERE created_at>='2026-06-01' AND created_at<'2026-06-02'`,
  },
  {
    group: "count",
    label: "COUNT audit date 30 days",
    sql: `SELECT count(*) FROM audit_logs WHERE created_at>='2026-06-01' AND created_at<'2026-07-01'`,
  },
  {
    group: "count",
    label: "COUNT audit search broad (the 3.8 s one)",
    sql: `SELECT count(*) FROM audit_logs WHERE model ILIKE '%Analysis%' OR operation ILIKE '%create%' OR request_id ILIKE '%req%'`,
  },
  {
    group: "count",
    label: "COUNT notifications unfiltered",
    sql: `SELECT count(*) FROM notifications`,
  },
  {
    group: "count",
    label: "COUNT notifications per-user",
    sql: `SELECT count(*) FROM notifications WHERE user_id='@notificationsUser'`,
  },
  {
    group: "count",
    label: "COUNT notifications capped at 2001",
    sql: `SELECT count(*) FROM (SELECT 1 FROM notifications WHERE user_id='@notificationsUser' LIMIT 2001) z`,
  },
  {
    group: "count",
    label: "COUNT notifications date week",
    sql: `SELECT count(*) FROM notifications WHERE created_at>='2026-06-01' AND created_at<'2026-06-08'`,
  },
  {
    group: "count",
    label: "COUNT notifications date 1 day",
    sql: `SELECT count(*) FROM notifications WHERE created_at>='2026-06-01' AND created_at<'2026-06-02'`,
  },
  {
    group: "count",
    label: "COUNT notifications date 30 days",
    sql: `SELECT count(*) FROM notifications WHERE created_at>='2026-06-01' AND created_at<'2026-07-01'`,
  },
  {
    // `notification.getStats`, which backs the unread badge on every sidebar mount. P2 gave it a
    // userId predicate but no date bound, so it is bounded in tenancy and unbounded in time.
    group: "count",
    label: "getStats groupBy isRead, per user, no date bound",
    sql: `SELECT is_read, count(*) FROM notifications WHERE user_id='@notificationsUser' GROUP BY is_read`,
  },
  {
    group: "count",
    label: "getStats groupBy isRead, unscoped",
    sql: `SELECT is_read, count(*) FROM notifications GROUP BY is_read`,
  },
  {
    group: "count",
    label: "COUNT prAnalyses unfiltered",
    sql: `SELECT count(*) FROM pull_request_analyses`,
  },
  { group: "count", label: "COUNT repos unfiltered", sql: `SELECT count(*) FROM repos` },
  { group: "count", label: "COUNT users unfiltered", sql: `SELECT count(*) FROM users` },
  {
    group: "count",
    label: "COUNT analyses per-repo",
    sql: `SELECT count(*) FROM analyses WHERE repo_id='@analysesRepo'`,
  },

  // ---- unbounded reads the app actually ships: no `take` anywhere ----
  {
    // Mirrors `analysis-lifecycle.service.ts:164` exactly: six small columns, no `resultJson`.
    // An earlier version of this shape selected `result_json` and reported ~2 MB per request —
    // the service never fetched it, so that number described a query the app does not issue.
    group: "unbounded",
    label: "getHistory: ALL analyses per repo (as the service selects it)",
    sql: `SELECT commit_sha,created_at,id,message,score,status FROM analyses WHERE repo_id='@analysesRepo' ORDER BY created_at DESC`,
  },
  {
    group: "unbounded",
    label: "getHistory: rows including resultJson (for contrast, not shipped)",
    sql: `SELECT id,status,score,result_json FROM analyses WHERE repo_id='@analysesRepo' ORDER BY created_at DESC`,
  },
  {
    group: "unbounded",
    label: "listByRepository: ALL prAnalyses per repo",
    sql: `SELECT id FROM pull_request_analyses WHERE repo_id='@prAnalysisRepo' ORDER BY created_at DESC`,
  },
  {
    group: "unbounded",
    label: "getByRepoId: ALL generatedFixes per repo",
    sql: `SELECT id FROM generated_fixes WHERE repo_id='@generatedFixRepo' ORDER BY created_at DESC`,
  },
  {
    group: "unbounded",
    label: "getComments: ALL prComments per analysis",
    sql: `SELECT id,body FROM pull_request_comments WHERE analysis_id='@prCommentAnalysis' ORDER BY file_path ASC, line ASC`,
  },
  {
    group: "unbounded",
    label: "getSessionHistory: ALL chatMessages per session",
    sql: `SELECT id FROM chat_messages WHERE session_id='@chatSession' ORDER BY created_at ASC`,
  },
  {
    group: "unbounded",
    label: "listSessions: ALL chatSessions per user",
    sql: `SELECT id FROM chat_sessions WHERE user_id='@chatSessionUser' ORDER BY updated_at DESC`,
  },
  {
    group: "unbounded",
    label: "getSessions: ALL sessions per user",
    sql: `SELECT id FROM sessions WHERE user_id='@sessionsUser' ORDER BY created_at DESC, id DESC`,
  },
  {
    group: "unbounded",
    label: "apiKeyService.list: ALL api keys, no where",
    sql: `SELECT id,prefix,hashed_key FROM api_keys ORDER BY created_at DESC`,
  },
  {
    group: "unbounded",
    label: "getMyRepos: ALL installations per user",
    sql: `SELECT id FROM github_installations WHERE user_id='@ghInstallUser' ORDER BY created_at ASC`,
  },
  {
    group: "unbounded",
    label: "getLinkedAccounts: accounts per user",
    sql: `SELECT id FROM accounts WHERE user_id='@accountsUser' ORDER BY provider_id ASC`,
  },
  {
    group: "unbounded",
    label: "loadLatestDocumentsWithContent: (type asc, updatedAt desc)",
    sql: `SELECT id,type FROM documents WHERE repo_id='@documentsRepo' ORDER BY type ASC, updated_at DESC`,
  },

  // ---- auth hot path: runs on sign-in, on session validation, on every API call ----
  {
    group: "auth",
    label: "session gate: session by token",
    sql: `SELECT id,user_id FROM sessions WHERE token='@sessionsToken'`,
  },
  {
    group: "auth",
    label: "session gate: session by token_hash",
    sql: `SELECT id,user_id FROM sessions WHERE token_hash='@sessionsTokenHash'`,
  },
  {
    group: "auth",
    label: "isBanned: bannedEmail by email_hash",
    sql: `SELECT id FROM banned_emails WHERE email_hash='@bannedEmailHash'`,
  },
  {
    group: "auth",
    label: "verifyApiKey: apiKey by hashed_key + user",
    sql: `SELECT k.id,k.revoked,u.id FROM api_keys k LEFT JOIN users u ON u.id=k.user_id WHERE k.hashed_key='@apiKeyHashedKey'`,
  },
  {
    group: "auth",
    label: "admin gate: user + _count.passkeys",
    sql: `SELECT u.id,(SELECT count(*) FROM passkeys p WHERE p.user_id=u.id) FROM users u LIMIT 1`,
  },
  {
    group: "auth",
    label: "getValidToken: account by user",
    sql: `SELECT id FROM accounts WHERE user_id='@accountsUser' AND provider_id='github' LIMIT 1`,
  },
  {
    group: "auth",
    label: "resolveClientContext: installation by owner+user",
    sql: `SELECT id FROM github_installations WHERE user_id='@ghInstallUser' AND account_login='@ghAccountLogin' AND is_suspended=false LIMIT 1`,
  },

  // ---- searches: trigram-backed and not ----
  {
    group: "search",
    label: "notifications title search (trigram)",
    sql: `SELECT count(*) FROM notifications WHERE title ILIKE '%Repo 199999%'`,
  },
  {
    group: "search",
    label: "notifications body search (trigram)",
    sql: `SELECT count(*) FROM notifications WHERE body ILIKE '%Repository 156506 produced%'`,
  },
  {
    group: "search",
    label: "users name search (trigram)",
    sql: `SELECT count(*) FROM users WHERE name ILIKE '%48213%'`,
  },
  {
    group: "search",
    label: "repos name search (trigram)",
    sql: `SELECT count(*) FROM repos WHERE name ILIKE '%repo_199999%'`,
  },
];

async function resolveHotKeys(client: Client): Promise<void> {
  // Resolving these costs ~13 s — fourteen full-table GROUP BY scans, against tables of 2.8M to
  // 2.9M rows. That is more time than every measured shape put together, and it puts the harness
  // itself at the top of `bench:stats`, burying the queries it is meant to profile. The answers
  // only change when the fixture does, so they are cached; `BENCH_REKEY=1` forces a refresh.
  if (process.env.BENCH_REKEY !== "1") {
    const cached = await Bun.file(HOT_KEY_CACHE)
      .json()
      .catch(() => null);
    const complete =
      cached != null &&
      Object.keys(hotKeys).every((k) => typeof cached[k] === "string" && cached[k] !== "");
    if (complete) {
      Object.assign(hotKeys, cached);
      return;
    }
  }

  // Quoted rather than passed as a bound parameter: the shapes embed literals so a shape
  // cannot grow its own lookup between runs. Escaping keeps a quote inside a stored token
  // from turning the statement into a syntax error.
  const pick = async (sql: string) => {
    const result = await client.query<{ k: string }>(sql);
    return (result.rows[0]?.k ?? "").replaceAll("'", "''");
  };

  hotKeys.analysesRepo = await pick(
    `SELECT repo_id::text k FROM analyses GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.documentsRepo = await pick(
    `SELECT repo_id::text k FROM documents GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.chatSession = await pick(
    `SELECT session_id::text k FROM chat_messages GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.prCommentAnalysis = await pick(
    `SELECT analysis_id::text k FROM pull_request_comments GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.prAnalysisRepo = await pick(
    `SELECT repo_id::text k FROM pull_request_analyses GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.generatedFixRepo = await pick(
    `SELECT repo_id::text k FROM generated_fixes GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.notificationsUser = await pick(
    `SELECT user_id::text k FROM notifications GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.sessionsUser = await pick(
    `SELECT user_id::text k FROM sessions GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.auditUser = await pick(
    `SELECT user_id::text k FROM audit_logs WHERE user_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.heavyRepoUser = await pick(
    `SELECT user_id::text k FROM repos GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.chatSessionUser = await pick(
    `SELECT user_id::text k FROM chat_sessions GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.accountsUser = await pick(
    `SELECT user_id::text k FROM accounts GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.ghInstallUser = await pick(
    `SELECT user_id::text k FROM github_installations WHERE user_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
  );
  hotKeys.sessionsToken = await pick(
    `SELECT token k FROM sessions WHERE token IS NOT NULL LIMIT 1`,
  );
  hotKeys.sessionsTokenHash = await pick(
    `SELECT token_hash k FROM sessions WHERE token_hash IS NOT NULL LIMIT 1`,
  );
  hotKeys.apiKeyHashedKey = await pick(
    `SELECT hashed_key k FROM api_keys WHERE hashed_key IS NOT NULL LIMIT 1`,
  );
  hotKeys.bannedEmailHash = await pick(
    `SELECT email_hash k FROM banned_emails WHERE email_hash IS NOT NULL LIMIT 1`,
  );
  hotKeys.ghAccountLogin = await pick(
    `SELECT account_login k FROM github_installations WHERE user_id='${hotKeys.ghInstallUser}' AND account_login IS NOT NULL LIMIT 1`,
  );

  await Bun.write(HOT_KEY_CACHE, `${JSON.stringify(hotKeys, null, 2)}\n`);
}

function fill(sql: string): string {
  let out = sql;
  // Longest key first: `@chatSession` is a prefix of `@chatSessionUser`, and replacing the
  // short one first would leave a `User` fragment glued onto the substituted value.
  const entries = Object.entries(hotKeys).sort((a, b) => b[0].length - a[0].length);
  for (const [name, value] of entries) {
    out = out.replaceAll(`@${name}`, value);
  }
  return out;
}

/**
 * A shape that resolves its own literals measures its own lookup, not the query. The original
 * defect was `WHERE repo_id=(SELECT repo_id FROM audit_logs GROUP BY repo_id ORDER BY count(*)
 * DESC LIMIT 1)`, where the inner aggregate re-scanned the whole table and inflated the
 * measurement by 2000x. Every literal now comes from `resolveHotKeys`; this keeps it that way.
 */
function assertNoSubqueryInWhere(sql: string, label: string) {
  if (/where[\s\S]*\(\s*select/i.test(sql)) {
    throw new Error(
      `shape "${label}" has a subquery in WHERE — it re-scans the table and inflates the result`,
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (url == null) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const info = await client.query<{ n: string; v: string }>(
    `SELECT current_database() n, version() v`,
  );
  console.log(`\n  db: ${info.rows[0]?.n}   runs: ${RUNS}\n`);

  await resolveHotKeys(client);

  const shapes = SHAPES.filter((s) => FILTER == null || s.label.toLowerCase().includes(FILTER));
  let group = "";

  for (const shape of shapes) {
    if (shape.group !== group) {
      group = shape.group;
      console.log(`\n── ${group} ${"─".repeat(Math.max(0, 58 - group.length))}`);
      console.log(
        `${"shape".padEnd(52)}${"p50".padStart(9)}${"p95".padStart(9)}${"p99".padStart(9)}${"min".padStart(9)}${"max".padStart(9)}`,
      );
    }

    const sql = fill(shape.sql);
    assertNoSubqueryInWhere(sql, shape.label);

    if (EXPLAIN) {
      const plan = await client.query(`EXPLAIN (ANALYZE, COSTS OFF) ${sql}`);
      const exec = plan.rows.find((r) => Object.keys(r)[0]?.startsWith("Execution"));
      console.log(
        `${shape.label.padEnd(52)}${String(exec?.[Object.keys(exec)[0]] ?? "").padStart(9)}`,
      );
      continue;
    }

    const times: number[] = [];
    let rows = 0;
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      const result = await client.query(sql);
      times.push(performance.now() - started);
      rows = result.rowCount ?? rows;
    }

    const stats = benchStats(times);
    const flag = stats.median > 100 ? "  ← SLOW" : "";
    console.log(
      `${shape.label.padEnd(52)}${stats.median.toFixed(2).padStart(9)}${stats.p95
        .toFixed(2)
        .padStart(
          9,
        )}${stats.p99.toFixed(2).padStart(9)}${stats.min.toFixed(2).padStart(9)}${stats.max.toFixed(2).padStart(9)}${flag}`,
    );
    void rows;
  }

  await client.end();
  console.log("");
}

await main();
