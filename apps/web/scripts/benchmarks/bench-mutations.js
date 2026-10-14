/**
 * Per-mutation latency, for every tRPC mutation the app exposes.
 *
 * Companion to `bench-procedures.js`, which covers the 53 queries. This one writes, so it is
 * split: the 25 mutations that only create or update run against the benchmark database, and the
 * 14 that delete are refused unless `BENCH_DESTRUCTIVE=1` is set — running them for real would
 * destroy the fixture every other measurement depends on, including the session doing the
 * measuring (`user.deleteAccount` deletes the caller).
 *
 * Usage:
 *   BENCH_SESSION_COOKIE=… BENCH_DESTRUCTIVE=1 BENCH_BASE_URL=… bun run bench:mutations
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

const BASE = __ENV.BENCH_BASE_URL || "http://localhost:3000";
const COOKIE_NAME = __ENV.BENCH_COOKIE_NAME || "__Secure-doxynix.session_token";
const COOKIE_VALUE = __ENV.BENCH_SESSION_COOKIE;
const ITERS = Number(__ENV.BENCH_ITERS || 5);
const WARMUP = Number(__ENV.BENCH_WARMUP || 1);
const PACE_MS = Number(__ENV.BENCH_PACE_MS || 120);
const DESTRUCTIVE = __ENV.BENCH_DESTRUCTIVE === "1";

if (!COOKIE_VALUE) {
  throw new Error(`BENCH_SESSION_COOKIE is required: copy the value of ${COOKIE_NAME}`);
}

const ID = (name) => {
  const v = __ENV[`BENCH_${name}`];
  if (!v) {
    throw new Error(`BENCH_${name} is required`);
  }
  return v;
};

const REPO = ID("HEAVY_REPO");
const NOTIF = ID("NOTIF_ID");
const FIX = ID("FIX_ID");
const KEY = ID("KEY_ID");
const AID = ID("HEAVY_ANALYSIS");
const ADMIN = ID("ADMIN_USER");
const OWNER = ID("REPO_OWNER");
const SCRATCH = __ENV.BENCH_SCRATCH_REPO || REPO;
const PR = Number(__ENV.BENCH_PR_NUMBER || 1);
const FIX_REPO = ID("FIX_REPO");
const BAN = ID("BAN_ID");
const BAN_OWNER = ID("ADMIN_USER");
const SESSION_ID = __ENV.BENCH_SESSION_ID ?? "";

/** name, input (or a per-iteration factory), destroys */
/** @type {Array<[string, ((i: number) => Record<string, unknown>) | Record<string, unknown>, boolean]>} */
const MUTATIONS = [
  // --- api keys: the id is the caller's own, resolved from the clone ---
  ["apikey.create", () => ({ description: "bench", name: `k-${unique("bench")}` }), false],
  ["apikey.update", { description: "bench 2", id: KEY, name: "bench-key-2" }, false],
  ["apikey.touch", { id: KEY }, false],

  // --- notifications: ids come from the clone; the bulk ones take the filter schema ---
  [
    "bannedEmail.create",
    (i) => ({ email: `${unique("bench-bl")}${i}@example.test`, reason: "BOUNCED" }),
    false,
  ],
  ["notification.markAs", { id: NOTIF, isRead: true }, false],
  ["notification.markAllAsRead", { type: "INFO" }, false],

  // --- repos / users ---
  ["repo.create", () => ({ url: `https://github.com/acme/bench-${unique("repo")}` }), false],
  ["user.updateUser", { name: "ТЕСТОВЫЙ АККАУНТ!" }, false],
  ["adminUser.setBanned", { banned: false, id: ADMIN, reason: null }, false],
  ["adminUser.setRole", { id: ADMIN, role: "ADMIN" }, false],

  // `installationId` is digits and `state` is a non-empty string — not the wider shape first tried
  // Needs a signed GitHub OAuth `state`; cannot be forged from outside the install flow.
  ["githubApp.saveInstallation", { installationId: "999999", state: "open" }, false],

  // --- analysis ---
  ["agent.createSession", { repoId: REPO }, false],
  [
    "analysis.configureRepository",
    { branch: "main", enabledDocTypes: [], model: "bench", provider: "OPENAI", repoId: REPO },
    false,
  ],
  // `filePath`, not `path` — the staging service keys its Redis entry on it
  ["analysis.stageFile", { content: "bench", filePath: "src/bench.ts", repoId: REPO }, false],
  ["analysis.unstageFile", { filePath: "src/bench.ts", repoId: REPO }, false],
  [
    "analysis.createFix",
    {
      findings: [{ file: "src/bench.ts", line: 1, suggestion: "bench", type: "style" }],
      repoId: REPO,
    },
    false,
  ],
  ["analysis.stageGeneratedFix", { fixId: FIX, repoId: FIX_REPO }, false],
  [
    "analysis.applyFix",
    {
      branch: "main",
      fixedFiles: [{ filePath: "src/bench.ts", newContent: "bench" }],
      fixId: FIX,
      repoId: REPO,
      title: "bench",
    },
    false,
  ],
  ["analysis.postCommentToPR", { body: "bench comment", prNumber: PR, repoId: REPO }, false],
  ["analysis.openPullRequest", { branch: "bench-branch", repoId: REPO, title: "bench pr" }, false],
  // FileActionInputSchema: analysisId optional, branch and content required
  [
    "analysis.documentFile",
    { branch: "main", content: "bench", path: "src/bench.ts", repoId: REPO },
    false,
  ],
  [
    "analysis.quickFileAudit",
    { branch: "main", content: "const a = 1;", path: "src/bench.ts", repoId: REPO },
    false,
  ],
  [
    "analysis.analyze",
    { docTypes: ["README"], files: ["src/bench.ts"], language: "typescript", repoId: REPO },
    false,
  ],
  ["analysis.pinAuditToDocs", { path: "src/bench.ts", repoId: REPO }, false],

  // --- destructive: refused unless BENCH_DESTRUCTIVE=1 ---
  ["analysis.clearStaging", { repoId: REPO }, true],
  ["analysis.cancel", { analysisId: AID }, true],
  ["apikey.revoke", { id: KEY }, true],
  ["bannedEmail.remove", { id: BAN }, true],
  ["notification.deleteOne", { id: NOTIF }, true],
  ["notification.deleteRead", { type: "INFO" }, true],
  ["repo.delete", { id: SCRATCH }, true],
  ["repo.deleteAll", {}, true],
  ["repo.deleteByOwner", { owner: OWNER }, true],
  ["user.removeAvatar", {}, true],
  // Needs a token that exists; the caller's own session id is passed at runtime.
  ["user.revokeSession", { sessionId: SESSION_ID }, true],
  // `sessionId`, not `userId` — the ref schema is a session, not a user.
  ["adminUser.revokeSession", { sessionId: SESSION_ID }, true],
  ["adminUser.deleteUser", { id: BAN_OWNER }, true],
  ["user.deleteAccount", {}, true],
];

const ONLY = __ENV.BENCH_ONLY;
const SELECTED =
  ONLY == null
    ? MUTATIONS
    : MUTATIONS.filter(([n]) => ONLY.split(",").some((frag) => n.includes(frag)));
const RUN = DESTRUCTIVE ? SELECTED : SELECTED.filter(([, , d]) => !d);

/**
 * Mutations that create must be given a fresh key every pass. Repeating the same email or repo
 * url works on the first iteration and fails the unique index on the second, which reads as a
 * failing procedure rather than as a reused fixture.
 */
let pass = 0;
function unique(base) {
  pass += 1;
  return `${base}-${pass}`;
}

// A mutation needs POST with the superjson envelope as the body. GET answers 405, and POST
// without a content type answers 415 — both are the transport, not the procedure.
const HEADERS = { "Content-Type": "application/json", Cookie: `${COOKIE_NAME}=${COOKIE_VALUE}` };
const TREND = Object.fromEntries(
  RUN.map(([name]) => [name, new Trend(`m_${name.replaceAll(".", "_")}`, true)]),
);

export const options = {
  iterations: ITERS,
  summaryTrendStats: ["min", "med", "p(95)", "p(99)", "max"],
  vus: 1,
};

export default function () {
  for (const [name, rawInput] of RUN) {
    const input = typeof rawInput === "function" ? rawInput(pass) : rawInput;
    const url = `${String(BASE)}/api/trpc/${name}`;
    const body = JSON.stringify({ json: input });
    for (let i = 0; i < WARMUP; i++) {
      http.post(url, body, { headers: HEADERS });
      sleep(PACE_MS / 1000);
    }
    const res = http.post(url, body, { headers: HEADERS });
    if (check(res, { "is 2xx": (r) => r.status >= 200 && r.status < 300 })) {
      TREND[name].add(res.timings.duration);
    } else {
      console.log(
        `  non-2xx ${name} -> ${Number(res.status)} :: ${String(res.body).slice(0, 140)}`,
      );
    }
    sleep(PACE_MS / 1000);
  }
}

export function handleSummary(data) {
  const checks = data.metrics.checks?.values ?? {};
  const pad = (v, n) => String(v).padEnd(n);
  const rpad = (v, n) => String(v).padStart(n);
  const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : v.toFixed(0));

  let out = `\n  url: ${BASE}   iters: ${ITERS}   destructive: ${DESTRUCTIVE ? "yes" : "no"}   mutations: ${RUN.length}\n\n`;
  out +=
    pad("mutation", 34) +
    rpad("p50", 9) +
    rpad("p95", 9) +
    rpad("p99", 9) +
    rpad("max", 9) +
    "   ok\n";
  out += "─".repeat(78) + "\n";
  for (const [name] of RUN) {
    const v = data.metrics[`m_${name.replaceAll(".", "_")}`]?.values ?? {};
    if (v.min == null) {
      out += pad(name, 34) + rpad("—", 9) + rpad("—", 9) + rpad("—", 9) + rpad("—", 9) + "   ✖\n";
      continue;
    }
    out +=
      pad(name, 34) +
      rpad(ms(v.med), 9) +
      rpad(ms(v["p(95)"]), 9) +
      rpad(ms(v["p(99)"]), 9) +
      rpad(ms(v.max), 9) +
      "   ✔\n";
  }
  out += `\n  ${checks.passes ?? 0} passed, ${checks.fails ?? 0} failed.\n\n`;
  return { stdout: out };
}
