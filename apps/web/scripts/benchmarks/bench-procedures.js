/**
 * Per-procedure HTTP latency, for every tRPC query the app exposes.
 *
 * `bench:queries` answers what each *shape* costs in the database. This answers what each
 * *procedure* costs end to end — routing, the ZenStack policy, the field-encryption extension and
 * serialization included — which is the number a user actually waits for.
 *
 * Queries only. The 39 mutations write, and the fixture every other measurement depends on must
 * not change under them.
 *
 * Usage:
 *   # server running, pointed at the benchmark database
 *   BENCH_SESSION_COOKIE='<value>' BENCH_HEAVY_REPO=… BENCH_ADMIN_USER=… \
 *     podman run --rm -i --network=host -e BENCH_SESSION_COOKIE -e BENCH_HEAVY_REPO … \
 *     -v "$PWD/scripts:/scripts:ro,Z" grafana/k6:latest run /scripts/bench-procedures.js
 *
 * Non-200 responses are reported per endpoint rather than folded into the percentiles: a 401 is
 * fast, and letting it into the numbers would make a broken run look like a fast one.
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

const BASE = __ENV.BENCH_BASE_URL || "http://localhost:3000";
const COOKIE_NAME = __ENV.BENCH_COOKIE_NAME || "__Secure-doxynix.session_token";
const COOKIE_VALUE = __ENV.BENCH_SESSION_COOKIE;
const ITERS = Number(__ENV.BENCH_ITERS || 8);
const WARMUP = Number(__ENV.BENCH_WARMUP || 2);
const PACE_MS = Number(__ENV.BENCH_PACE_MS || 100);

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
const AID = ID("HEAVY_ANALYSIS");
const PR_REPO = ID("PR_REPO");
const PR_AID = ID("PR_AID");
const PR_NUMBER = Number(__ENV.BENCH_PR_NUMBER || 1);
const SESSION = ID("CHAT_SESSION");
const FIX = ID("FIX");
const ADMIN = ID("ADMIN_USER");
const AUDIT = ID("AUDIT_ID");
const OWNER = ID("REPO_OWNER");
const NAME = ID("REPO_NAME");

/** @type {Array<[string, Record<string, unknown>]>} */
// `module.procedure` plus the input the procedure accepts. Anything omitted here is either a
// mutation or was not resolvable from the router source.
const PROCEDURES = [
  // --- admin: need an admin session, and an admin with no data measures empty results ---
  ["adminAudit.detail", { id: AUDIT }],
  ["adminAudit.list", { limit: 20, page: 1 }],
  ["adminAudit.payloadHtml", { id: AUDIT }],
  ["adminReview.detail", { id: PR_AID }],
  ["adminReview.list", { limit: 20, page: 1 }],
  ["adminUser.getDetail", { id: ADMIN }],
  ["adminUser.list", { cursor: 1, limit: 20 }],
  ["adminUser.listSessions", { id: ADMIN }],
  ["bannedEmail.list", { limit: 20, page: 1 }],

  // --- analysis, scoped to the heaviest repository on the clone ---
  ["analysis.getHistory", { repoId: REPO }],
  ["analysis.getLatest", { repoId: REPO }],
  ["analysis.getWorkspace", { repoId: REPO }],
  ["analysis.getDetailedMetrics", { repoId: REPO }],
  ["analysis.getAvailableDocs", { aid: AID, repoId: REPO }],
  ["analysis.getStructureMap", { repoId: REPO }],
  ["analysis.listByRepository", { repoId: REPO }],
  ["analysis.getByRepository", { repoId: REPO }],
  ["analysis.getRepoConfig", { repoId: REPO }],
  ["analysis.getStagedFiles", { repoId: REPO }],
  ["analysis.getWithGraphLinks", { repoId: REPO }],
  ["analysis.searchWorkspace", { repoId: REPO, search: "auth" }],
  ["analysis.getDocumentContent", { repoId: REPO, type: "README" }],
  ["analysis.getByPRNumber", { prNumber: PR_NUMBER, repoId: PR_REPO }],
  ["analysis.getAnalysis", { analysisId: PR_AID }],
  ["analysis.getComments", { analysisId: PR_AID }],

  ["analysis.getFileActionResult", { fixId: FIX }],
  ["githubBrowse.getRepoFiles", { name: NAME, owner: OWNER }],
  ["githubApp.getGithubInstallUrl", { installId: "1" }],
  ["analysis.getById", { fixId: FIX }],

  // --- analytics: one raw statement each, the whole dashboard and the trend chart ---
  ["analytics.getDashboardStats", { period: "30d" }],
  ["analytics.getTrends", { period: "30d" }],

  // --- lists with paginators and counts ---
  ["apikey.list", {}],
  ["audit.getActivityLogs", { limit: 20 }],
  ["audit.getLogPayloadHtml", { logId: AUDIT }],
  ["notification.getAll", { limit: 20, page: 1 }],
  ["notification.getStats", {}],
  ["repo.getAll", { limit: 20, page: 1, sortBy: "updatedAt" }],
  ["repo.getSlim", { direction: "forward", limit: 20 }],
  ["repo.getByName", { name: NAME, owner: OWNER }],
  ["repo.getByOwner", { owner: OWNER }],
  ["user.getActiveSessions", {}],
  ["user.getLinkedAccounts", {}],
  ["user.me", {}],
  ["agent.listSessions", {}],
  ["agent.getSessionHistory", { sessionId: SESSION }],
  ["githubApp.getMyGithubRepos", {}],
  ["health.check", {}],
];

const ONLY = __ENV.BENCH_ONLY;
const RUN =
  ONLY == null
    ? PROCEDURES
    : PROCEDURES.filter(([n]) => ONLY.split(",").some((frag) => n.includes(frag)));

const PARAMS = { headers: { Cookie: `${COOKIE_NAME}=${COOKIE_VALUE}` } };
// k6 refuses to create a metric outside the init context, so every one is declared up front.
const TREND = Object.fromEntries(
  PROCEDURES.map(([name]) => [name, new Trend(`p_${name.replaceAll(".", "_")}`, true)]),
);

export const options = {
  iterations: ITERS,
  summaryTrendStats: ["min", "med", "p(90)", "p(95)", "p(99)", "max"],
  vus: 1,
};

export default function () {
  for (const [name, input] of RUN) {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    const url = `${String(BASE)}/api/trpc/${name}?input=${encoded}`;
    for (let i = 0; i < WARMUP; i++) {
      http.get(url, PARAMS);
      sleep(PACE_MS / 1000);
    }
    const res = http.get(url, PARAMS);
    const ok = check(res, { "is 200": (r) => r.status === 200 });
    if (ok) {
      TREND[name].add(res.timings.duration);
    } else {
      console.log(
        `  non-200 ${name} -> ${Number(res.status)} :: ${String(res.body).slice(0, 120)}`,
      );
    }
    sleep(PACE_MS / 1000);
  }
}

export function handleSummary(data) {
  const checks = data.metrics.checks?.values ?? {};
  const fails = checks.fails ?? 0;
  const passes = checks.passes ?? 0;

  const pad = (v, n) => String(v).padEnd(n);
  const rpad = (v, n) => String(v).padStart(n);
  const ms = (v) =>
    v >= 1000 ? (v / 1000).toFixed(1) + "s" : v >= 100 ? v.toFixed(0) : v.toFixed(1);

  let out = `\n  url: ${BASE}   iters: ${ITERS}   procedures: ${RUN.length}\n\n`;
  out +=
    pad("procedure", 32) +
    rpad("p50", 9) +
    rpad("p95", 9) +
    rpad("p99", 9) +
    rpad("max", 9) +
    "   ok\n";
  out += "─".repeat(76) + "\n";

  const rows = [];
  for (const [name] of RUN) {
    const v = data.metrics[`p_${name.replaceAll(".", "_")}`]?.values ?? {};
    if (v.min == null) {
      rows.push([pad(name, 32), rpad("—", 9), rpad("—", 9), rpad("—", 9), rpad("—", 9), "  ✖"]);
      continue;
    }
    rows.push([
      pad(name, 32),
      rpad(ms(v.med), 9),
      rpad(ms(v["p(95)"]), 9),
      rpad(ms(v["p(99)"]), 9),
      rpad(ms(v.max), 9),
      "   ✔",
    ]);
  }
  out += rows.map((r) => r.join("")).join("\n");
  out += `\n\n  ${passes} passed, ${fails} failed out of ${passes + fails} checks.\n\n`;
  return { stdout: out };
}
