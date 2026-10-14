/**
 * HTTP layer benchmark — the fourth measurement layer.
 *
 * `bench:queries` measures SQL against the server, `bench:driver` the same SQL through the
 * Prisma client, and `pg_stat_statements` what production actually ran. This one is the only
 * harness that sees everything at once: tRPC routing, the ZenStack policy, the field-encryption
 * extension, and JSON serialization. It is also the only one that needs a running server.
 *
 * Single VU and sequential on purpose. The other three harnesses are single-session, and a
 * parallel load test here would mostly measure the server's own concurrency rather than the
 * per-request cost this file is comparing against them.
 *
 * Usage:
 *   # server must already be running, pointed at the benchmark database:
 *   #   doppler run -- bash -c 'DATABASE_URL=…dxnx_web_stress bun x next start'
 *   BENCH_SESSION_COOKIE='<value>' podman run --rm -i \
 *     -v "$PWD/scripts:/scripts:ro,Z" grafana/k6:latest run /scripts/bench-http.js
 *
 * Env:
 *   BENCH_BASE_URL        default http://localhost:3000
 *   BENCH_SESSION_COOKIE  value of the session cookie, without the name. Required.
 *   BENCH_COOKIE_NAME     default __Secure-doxynix.session_token — `useSecureCookies` is on
 *                         in a production build, so the plain name is not sent or read.
 *   BENCH_ITERS           measured passes over the endpoint set, default 20
 *   BENCH_WARMUP          unrecorded passes before measuring, default 3
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

const BASE = __ENV.BENCH_BASE_URL || "http://localhost:3000";
const COOKIE_NAME = __ENV.BENCH_COOKIE_NAME || "__Secure-doxynix.session_token";
const COOKIE_VALUE = __ENV.BENCH_SESSION_COOKIE;
const ITERS = Number(__ENV.BENCH_ITERS || 20);
const WARMUP = Number(__ENV.BENCH_WARMUP || 3);
// The global limiter in `proxy.ts` allows 20 requests per 10 s. Firing an iteration flat out
// is 24 requests, so an unpaced run measures the limiter's queue rather than the app. Pacing
// also reads closer to how a browser actually behaves than a single VU at full speed.
const PACE_MS = Number(__ENV.BENCH_PACE_MS || 120);

if (!COOKIE_VALUE) {
  throw new Error(`BENCH_SESSION_COOKIE is required: copy the value of ${COOKIE_NAME}`);
}

// `input={"json":{}}` is the superjson envelope every procedure expects. Endpoints that take
// real arguments need their own shape added here — the point is the per-request overhead, so
// each call is the smallest one the procedure accepts.
const ENDPOINTS = [
  { name: "notification.getStats", path: "notification.getStats" },
  { name: "notification.getAll", path: "notification.getAll" },
  { name: "repo.getSlim", path: "repo.getSlim" },
  { name: "repo.getAll", path: "repo.getAll" },
  { name: "analytics.getTrends", path: "analytics.getTrends" },
  { name: "analytics.getDashboardStats", path: "analytics.getDashboardStats" },
];

const PARAMS = { headers: { Cookie: `${COOKIE_NAME}=${COOKIE_VALUE}` } };
const TRENDS = Object.fromEntries(
  ENDPOINTS.map((e) => [e.name, new Trend(`ep_${e.name.replaceAll(".", "_")}`, true)]),
);

export const options = {
  iterations: ITERS,
  // k6 reports only p(90) and p(95) by default; without this the p99 column is silently zero.
  summaryTrendStats: ["min", "med", "p(90)", "p(95)", "p(99)", "max"],
  vus: 1,
};

export default function () {
  for (const ep of ENDPOINTS) {
    const url = `${BASE}/api/trpc/${ep.path}?input=%7B%22json%22%3A%7B%7D%7D`;
    for (let i = 0; i < WARMUP; i++) {
      http.get(url, PARAMS);
      sleep(PACE_MS / 1000);
    }
    const res = http.get(url, PARAMS);
    // A 401 or 500 is fast; recording it would make a broken endpoint look like a cheap one.
    if (res.status !== 200) {
      console.log(`  non-200: ${ep.name} -> ${res.status}`);
    }
    check(res, { "is 200": (r) => r.status === 200 });
    TRENDS[ep.name].add(res.timings.duration);
    sleep(PACE_MS / 1000);
  }
}

export function handleSummary(data) {
  const checks = data.metrics.checks?.values ?? {};
  const passes = checks.passes ?? 0;
  const fails = checks.fails ?? 0;

  // k6 computes the percentiles itself; a Trend exposes `med`/`p(95)`/`p(99)`, not the raw
  // samples, so reading them back is both shorter and the only way that matches its own report.
  const rows = ENDPOINTS.map((ep) => {
    const v = data.metrics[`ep_${ep.name.replaceAll(".", "_")}`]?.values ?? {};
    return {
      max: v.max ?? 0,
      min: v.min ?? 0,
      // One measured request per endpoint per iteration, so this is exact, not an estimate.
      n: v.min == null ? 0 : ITERS,
      name: ep.name,
      p50: v.med ?? 0,
      p95: v["p(95)"] ?? 0,
      p99: v["p(99)"] ?? 0,
    };
  });

  const pad = (v, n) => String(v).padEnd(n);
  const rpad = (v, n) => String(v).padStart(n);
  const ms = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));

  let out = `\n  url: ${BASE}   iters: ${ITERS}   warmup: ${WARMUP}   pace: ${PACE_MS}ms\n\n`;
  out +=
    pad("endpoint", 30) +
    rpad("n", 5) +
    rpad("p50", 10) +
    rpad("p95", 10) +
    rpad("p99", 10) +
    rpad("min", 9) +
    rpad("max", 10) +
    "   200\n";
  out += "─".repeat(84) + "\n";
  for (const r of rows) {
    out +=
      pad(r.name, 30) +
      rpad(r.n, 5) +
      rpad(ms(r.p50), 10) +
      rpad(ms(r.p95), 10) +
      rpad(ms(r.p99), 10) +
      rpad(ms(r.min), 9) +
      rpad(ms(r.max), 10) +
      `   ${passes}/${passes + fails}\n`;
  }
  out += "\n  ms. One measured request per endpoint per iteration; warmup passes are discarded.\n";

  if (fails > 0) {
    out += `\n  ${fails} ответов не 200 — их времена попали в статистику, перезапусти после правки.\n`;
  }
  out += "\n";

  return { stdout: out };
}
