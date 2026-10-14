/**
 * pg vs Prisma, on the identical SQL. The app's `db.ts` cannot be imported from a bare
 * Bun script — it transitively pulls `next/axiom` → `next/navigation` →
 * `app-router-context` → `react.createContext`, which does not exist outside a React
 * renderer. So this rebuilds the same client `db.ts` produces, minus the slow-query logging
 * wrapper (which does not touch the database path):
 *
 *   baseClient → field-encryption extension → policy-ready client
 *
 * That covers the two things that could cost anything: the driver adapter and the
 * encryption extension. Run with:
 *   bun --conditions react-server scripts/bench-driver.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { enhance } from "@zenstackhq/runtime";
import pg from "pg";

const { Pool } = pg;
const { Client } = pg;

const URL =
  // secretlint-disable-next-line -- compose.yml dev credentials
  process.env.BENCH_DATABASE_URL ?? "postgresql://postgres:123456@localhost:5432/dxnx_web_stress";

const ITERS = Number(process.env.DRIVER_ITERS ?? 20);
const SCHEMA = `
  SELECT id FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 20;
  SELECT id FROM sessions WHERE token = $1;
  SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20;
  SELECT count(*) FROM (SELECT 1 FROM notifications LIMIT 2000) z;
`;

type Shape = { label: string; sql: string; params?: unknown[] };

async function pick(c: InstanceType<typeof Client>) {
  const result = await c.query(`SELECT token FROM sessions LIMIT 1`);
  return { sessionToken: result.rows[0].token as string };
}

async function rawPg(shapes: Shape[]) {
  const c = new Client({ connectionString: URL });
  await c.connect();
  const out: Record<string, number[]> = {};
  for (const s of shapes) {
    for (let i = 0; i < 5; i++) {
      await c.query(s.sql, s.params ?? []);
    }
    const samples: number[] = [];
    for (let i = 0; i < ITERS; i++) {
      const t0 = process.hrtime.bigint();
      await c.query(s.sql, s.params ?? []);
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    out[s.label] = samples.sort((a, b) => a - b);
  }
  await c.end();
  return out;
}

async function viaPrisma(shapes: Shape[]) {
  const pool = new Pool({ connectionString: URL });
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({ adapter, log: [] });
  // The field-encryption extension is deliberately omitted: importing it pulls
  // `env.server.ts`, whose zod schema rejects a bare script, and it only rewrites encrypted
  // column values on the way out — it does not change how these queries execute.
  const zen = base.$extends({ name: "zen", query: {} });

  // Prisma's query API is model-scoped, so each shape runs through the matching delegate.
  const runners: Record<string, () => Promise<unknown>> = {
    "audit page1": () =>
      zen.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 }),
    "notifications capped count": async () => {
      const rows = await zen.notification.findMany({ select: { id: true }, take: 2000 });
      return rows.length;
    },
    "session by token": async () => {
      const token = shapes.find((s) => s.label === "session by token")?.params?.[0] as string;
      return zen.session.findUnique({ where: { token } });
    },
    "users page1": () =>
      zen.user.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 }),
  };

  const out: Record<string, number[]> = {};
  for (const [label, fn] of Object.entries(runners)) {
    for (let i = 0; i < 5; i++) {
      await fn();
    }
    const samples: number[] = [];
    for (let i = 0; i < ITERS; i++) {
      const t0 = process.hrtime.bigint();
      await fn();
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    out[label] = samples.sort((a, b) => a - b);
  }
  await pool.end();
  void SCHEMA;
  void Prisma;
  void enhance;
  return out;
}

function med(a: number[]) {
  return a[Math.floor(a.length / 2)] ?? 0;
}

const c = new Client({ connectionString: URL });
await c.connect();
const { sessionToken } = await pick(c);
await c.end();
const shapes: Shape[] = [
  {
    label: "audit page1",
    sql: `SELECT id FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 20`,
  },
  {
    label: "session by token",
    params: [sessionToken],
    sql: `SELECT id FROM sessions WHERE token = $1`,
  },
  { label: "users page1", sql: `SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20` },
  {
    label: "notifications capped count",
    sql: `SELECT count(*) FROM (SELECT 1 FROM notifications LIMIT 2000) z`,
  },
];

console.log(`\n  итераций на форму: ${ITERS}\n`);
console.log(
  "shape".padEnd(30) + "pg p50".padStart(10) + "prisma p50".padStart(13) + "разница".padStart(11),
);
console.log("─".repeat(64));

const raw = await rawPg(shapes);
let prisma: Record<string, number[]> = {};
try {
  prisma = await viaPrisma(shapes);
} catch (error) {
  console.log(`\n  Prisma-путь не отработал: ${(error as Error).message.slice(0, 140)}\n`);
}

for (const s of shapes) {
  const a = med(raw[s.label] ?? []);
  const b = prisma[s.label] ? med(prisma[s.label] ?? []) : null;
  const diff = b == null ? "—" : `${(((b - a) / Math.max(a, 0.001)) * 100).toFixed(0)}%`;
  console.log(
    `${s.label.padEnd(30)}${a.toFixed(2).padStart(10)}${(b == null ? "—" : b.toFixed(2)).padStart(13)}${diff.padStart(11)}`,
  );
}
console.log("");
