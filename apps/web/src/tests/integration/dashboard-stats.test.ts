import { getDashboardStats } from "@prisma/client/sql";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import { cleanupDatabase, createTestUser } from "../helpers";

/**
 * The pre-optimisation formulation, kept as a reference oracle. `getDashboardStats.sql` used to
 * run five independent `COUNT(CASE WHEN a.status = ...)` subqueries, each re-scanning
 * `analyses JOIN user_repos`; it now aggregates once in a `status_agg` CTE. The counters are
 * period-scoped by design and the oracle encodes that rule on purpose — both bound the same
 * window, so any drift between them means the shipped query stopped honouring the period.
 */
const REFERENCE_SQL = `
WITH periods AS (
    SELECT $2::timestamp AS cur_start, ($4::date + interval '1 day')::timestamp AS cur_end,
           $3::timestamp AS prev_start, $2::timestamp AS prev_end
),
user_repos AS (SELECT id, name, owner, created_at FROM repos WHERE created_by_user_id = $1::uuid),
base_data AS (
    SELECT a.*, ur.name as repo_name,
        (a.created_at >= p.cur_start AND a.created_at < p.cur_end) as is_current,
        (a.created_at >= p.prev_start AND a.created_at < p.prev_end) as is_previous
    FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p
    WHERE a.status = 'DONE' AND a.created_at >= p.prev_start AND a.created_at < p.cur_end
),
latest_per_repo AS (
    SELECT DISTINCT ON (repo_id, period_group) *,
        CASE WHEN is_current THEN 1 ELSE 2 END as period_group
    FROM base_data
    ORDER BY repo_id, period_group, created_at DESC
)
SELECT
    (SELECT COUNT(*)::int FROM user_repos ur CROSS JOIN periods p WHERE ur.created_at < p.cur_end) AS "repoCount",
    (SELECT COUNT(*)::int FROM documents d JOIN user_repos ur ON d.repo_id = ur.id CROSS JOIN periods p WHERE d.created_at < p.cur_end) AS "docCount",
    (SELECT COUNT(CASE WHEN a.status = 'FAILED' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at >= p.cur_start AND a.created_at < p.cur_end) AS "failedCount",
    (SELECT COUNT(CASE WHEN a.status = 'PENDING' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at >= p.cur_start AND a.created_at < p.cur_end) AS "pendingCount",
    (SELECT COUNT(CASE WHEN a.status = 'DONE' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at >= p.cur_start AND a.created_at < p.cur_end) AS "successCount",
    (SELECT COUNT(CASE WHEN a.status = 'NEW' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at >= p.cur_start AND a.created_at < p.cur_end) AS "newCount",
    (SELECT COUNT(*)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at >= p.cur_start AND a.created_at < p.cur_end) AS "totalCount",
    COALESCE((SELECT AVG(score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgHealth",
    COALESCE((SELECT AVG(security_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgSecurity",
    COALESCE((SELECT AVG(complexity_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgComplexity",
    COALESCE((SELECT AVG(onboarding_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgOnboarding",
    COALESCE((SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgTechDebt",
    COALESCE((SELECT COUNT(DISTINCT repo_id) FROM latest_per_repo WHERE is_current AND score < 50), 0)::int AS "criticalRepoCount",
    COALESCE((SELECT AVG(score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(score) FROM latest_per_repo WHERE is_previous), 0)::int AS "healthDelta",
    COALESCE((SELECT AVG(security_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(security_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "securityDelta",
    COALESCE((SELECT AVG(complexity_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(complexity_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "complexityDelta",
    COALESCE((SELECT AVG(onboarding_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(onboarding_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "onboardingDelta",
    COALESCE((SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "techDebtDelta",
    COALESCE((SELECT SUM(COALESCE((metrics_json->>'totalLoc')::numeric, 0)) FROM latest_per_repo WHERE is_current), 0)::int AS "totalLoc",
    COALESCE((SELECT COUNT(*)::int FROM latest_per_repo WHERE is_current AND COALESCE((metrics_json->>'busFactor')::int, 0) = 1), 0)::int AS "busFactorRepos"
FROM periods p
`;

type Statuses = Record<string, unknown>;

/** Only the columns REFERENCE_SQL reproduces; the shipped query returns more. */
const COMPARED = [
  "repoCount",
  "docCount",
  "failedCount",
  "pendingCount",
  "successCount",
  "newCount",
  "totalCount",
  "avgHealth",
  "avgSecurity",
  "avgComplexity",
  "avgOnboarding",
  "avgTechDebt",
  "criticalRepoCount",
  "healthDelta",
  "securityDelta",
  "complexityDelta",
  "onboardingDelta",
  "techDebtDelta",
  "totalLoc",
  "busFactorRepos",
] as const;

function project(row: Statuses): Record<string, unknown> {
  return Object.fromEntries(COMPARED.map((key) => [key, row[key]]));
}

const DAY = 86_400_000;

async function reference(
  userId: string,
  currentStart: Date,
  previousStart: Date,
  currentEnd: Date,
) {
  const [row] = await prisma.$queryRawUnsafe<Statuses[]>(
    REFERENCE_SQL,
    userId,
    currentStart,
    previousStart,
    currentEnd,
  );
  return row;
}

async function shipped(userId: string, currentStart: Date, previousStart: Date, currentEnd: Date) {
  const [row] = await prisma.$queryRawTyped(
    getDashboardStats(userId, currentStart, previousStart, currentEnd),
  );
  return row as unknown as Statuses;
}

/** Runs the shipped query with `TimeZone` pinned, so a boundary bug cannot hide behind UTC. */
async function runDashboardStatsUnderTimeZone(
  userId: string,
  currentStart: Date,
  previousStart: Date,
  currentEnd: Date,
  timeZone: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL TimeZone = '${timeZone}'`);
    const [row] = await tx.$queryRawTyped(
      getDashboardStats(userId, currentStart, previousStart, currentEnd),
    );
    return row as unknown as Statuses;
  });
}

async function seed(userId: string, workspaceId: string, repoCount: number, analysisCount: number) {
  const now = Date.now();
  for (let r = 0; r < repoCount; r++) {
    const repo = await prisma.repo.create({
      data: {
        createdAt: new Date(now - (30 + r) * DAY),
        createdByUserId: userId,
        githubId: 900_000_000 + r,
        name: `repo_${r}`,
        owner: `org_${r}`,
        url: `https://github.com/org_${r}/repo_${r}`,
        workspaceId,
      },
    });

    for (let a = 0; a < analysisCount; a++) {
      const status = (["DONE", "FAILED", "PENDING", "NEW"] as const)[a % 4];
      await prisma.analysis.create({
        data: {
          commitSha: `sha_${r}_${a}`,
          createdAt: new Date(now - (a + 1) * 3_600_000),
          repoId: repo.id,
          score: (r * 7 + a * 3) % 101,
          status,
          updatedAt: new Date(now),
          ...(status === "DONE"
            ? {
                complexityScore: (r * 11 + a * 5) % 101,
                metricsJson: { busFactor: (r + a) % 2, totalLoc: 100 + r * 10 + a },
                onboardingScore: (r * 13 + a * 7) % 101,
                resultJson: { findings: [] },
                securityScore: (r * 17 + a * 11) % 101,
                techDebtScore: (r * 19 + a * 13) % 101,
              }
            : {}),
        },
      });
    }

    await prisma.document.create({
      data: {
        content: `# repo_${r}`,
        createdAt: new Date(now - 2 * DAY),
        repoId: repo.id,
        type: "README",
        updatedAt: new Date(now - DAY),
        version: `v_${r}`,
      },
    });
  }
}

async function seedAcrossPeriods(
  userId: string,
  workspaceId: string,
  label: string,
  insideCount: number,
  outsideCount: number,
) {
  const repo = await prisma.repo.create({
    data: {
      createdByUserId: userId,
      githubId: 910_000_000 + Math.floor(Math.random() * 10_000_000),
      name: label,
      owner: "org",
      url: `https://github.com/org/${label}`,
      workspaceId,
    },
  });

  // The window under test is the last 30 days, so the previous period starts here.
  const boundary = Date.now() - 30 * DAY;
  const statuses = ["DONE", "FAILED", "PENDING", "NEW"] as const;

  const metrics = (i: number) => ({
    complexityScore: 20 + (i % 3) * 7,
    metricsJson: { busFactor: i % 2, totalLoc: 200 + i * 15 },
    onboardingScore: 60 - (i % 4) * 4,
    securityScore: 40 + (i % 5) * 3,
    techDebtScore: 30 + (i % 6) * 2,
  });

  for (let i = 0; i < insideCount; i++) {
    await prisma.analysis.create({
      data: {
        commitSha: `inside-${label}-${i}`,
        createdAt: new Date(boundary + (i + 1) * 3_600_000),
        repoId: repo.id,
        score: 50,
        status: statuses[i % statuses.length] ?? "NEW",
        updatedAt: new Date(),
        ...metrics(i),
      },
    });
  }

  for (let i = 0; i < outsideCount; i++) {
    await prisma.analysis.create({
      data: {
        commitSha: `outside-${label}-${i}`,
        createdAt: new Date(boundary - (i + 1) * 3_600_000),
        repoId: repo.id,
        score: 50,
        status: statuses[i % statuses.length] ?? "NEW",
        updatedAt: new Date(),
        ...metrics(i + insideCount),
      },
    });
  }

  return repo;
}

const WINDOWS = [
  { current: 15 * 60_000, label: "15m", previous: 30 * 60_000 },
  { current: DAY, label: "24h", previous: 2 * DAY },
  { current: 30 * DAY, label: "30d", previous: 60 * DAY },
  { current: 90 * DAY, label: "90d", previous: 180 * DAY },
];

describe("getDashboardStats", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("matches the reference formulation across every period window", async () => {
    const { user, workspace } = await createTestUser("Dashboard");
    await seed(user.id, workspace.id, 3, 6);
    // A second repo straddling the boundary is what makes the previous-period averages — and
    // therefore every `*Delta` column — non-zero, so the oracle has something to disagree about.
    await seedAcrossPeriods(user.id, workspace.id, "prior_repo", 3, 3);

    const now = Date.now();
    for (const w of WINDOWS) {
      const currentStart = new Date(now - w.current);
      const previousStart = new Date(now - w.previous);
      const currentEnd = new Date(now);

      const actual = await shipped(user.id, currentStart, previousStart, currentEnd);
      const expected = await reference(user.id, currentStart, previousStart, currentEnd);

      expect(actual, `window ${w.label} — reference returned no row`).toBeDefined();
      expect(expected, `window ${w.label} — reference returned no row`).toBeDefined();
      expect(project(actual), `window ${w.label}`).toEqual(project(expected!));
    }
  });

  it("splits every analysis into exactly one status bucket", async () => {
    const { user, workspace } = await createTestUser("Buckets");
    await seed(user.id, workspace.id, 4, 8);

    const now = Date.now();
    const row = await shipped(
      user.id,
      new Date(now - 30 * DAY),
      new Date(now - 60 * DAY),
      new Date(now),
    );

    const buckets =
      Number(row.failedCount) +
      Number(row.pendingCount) +
      Number(row.successCount) +
      Number(row.newCount);

    expect(buckets).toBe(Number(row.totalCount));
    expect(Number(row.totalCount)).toBe(32);
  });

  it("returns zeroes rather than nulls for a user with no repositories", async () => {
    const { user } = await createTestUser("Empty");
    const now = Date.now();

    const row = await shipped(user.id, new Date(now - DAY), new Date(now - 2 * DAY), new Date(now));

    expect(row.repoCount).toBe(0);
    expect(row.docCount).toBe(0);
    expect(row.totalCount).toBe(0);
    expect(row.failedCount).toBe(0);
    expect(row.avgHealth).toBe(0);
  });

  it("returns zeroes when the window predates all activity", async () => {
    const { user, workspace } = await createTestUser("Quiet");
    await seed(user.id, workspace.id, 2, 4);
    const day = 86_400_000;

    const row = await shipped(
      user.id,
      new Date(Date.now() - 400 * day),
      new Date(Date.now() - 420 * day),
      new Date(Date.now() - 390 * day),
    );

    expect(row.repoCount).toBe(0);
    expect(row.docCount).toBe(0);
    expect(row.totalCount).toBe(0);
  });

  it("scopes to the calling user and ignores another user's rows", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    await seed(alice.user.id, alice.workspace.id, 2, 4);
    await seed(bob.user.id, bob.workspace.id, 5, 4);

    const now = Date.now();
    const row = await shipped(
      alice.user.id,
      new Date(now - 30 * DAY),
      new Date(now - 60 * DAY),
      new Date(now),
    );

    expect(Number(row.repoCount)).toBe(2);
    expect(Number(row.totalCount)).toBe(8);
  });

  it("returns identical rows under every session TimeZone", async () => {
    const { user, workspace } = await createTestUser("TimeZone");
    await seed(user.id, workspace.id, 3, 6);

    const now = Date.now();
    // Late-evening UTC: if anything ever starts interpreting the period bounds in the session
    // zone, this instant is the one where the three zones disagree most about which day it is.
    const currentEnd = new Date(`${new Date(now).toISOString().slice(0, 10)}T22:00:00.000Z`);
    const currentStart = new Date(currentEnd.getTime() - 30 * DAY);
    const previousStart = new Date(currentStart.getTime() - 30 * DAY);

    // Rows straddling `cur_end` are what make the zones distinguishable. Every column involved
    // is `timestamp without time zone` and `@prisma/adapter-pg` sends Date params as a zone-less
    // UTC string, so nothing in the path interprets a zone and all three must agree. Rows further
    // out would pass even if a zone-sensitive cast were reintroduced.
    const gapRepo = await prisma.repo.findFirstOrThrow({ where: { workspaceId: workspace.id } });
    for (const offsetHours of [4, 12]) {
      await prisma.analysis.create({
        data: {
          commitSha: `sha_gap_${offsetHours}`,
          createdAt: new Date(currentEnd.getTime() + offsetHours * 3_600_000),
          repoId: gapRepo.id,
          score: 50,
          status: "NEW",
          updatedAt: new Date(),
        },
      });
    }

    const utc = await runDashboardStatsUnderTimeZone(
      user.id,
      currentStart,
      previousStart,
      currentEnd,
      "UTC",
    );
    const tokyo = await runDashboardStatsUnderTimeZone(
      user.id,
      currentStart,
      previousStart,
      currentEnd,
      "Asia/Tokyo",
    );
    const losAngeles = await runDashboardStatsUnderTimeZone(
      user.id,
      currentStart,
      previousStart,
      currentEnd,
      "America/Los_Angeles",
    );

    expect(tokyo).toEqual(utc);
    expect(losAngeles).toEqual(utc);
  });

  it("counts statuses only inside the selected period", async () => {
    const { user, workspace } = await createTestUser("Scoped");
    await seedAcrossPeriods(user.id, workspace.id, "scoped_repo", 4, 8);

    const now = Date.now();
    const row = await shipped(
      user.id,
      new Date(now - 30 * DAY),
      new Date(now - 60 * DAY),
      new Date(now),
    );

    expect(Number(row.totalCount)).toBe(4);
    expect(Number(row.successCount)).toBe(1);
    expect(Number(row.failedCount)).toBe(1);
  });

  it("returns the same extremes and top-N on every run", async () => {
    const { user, workspace } = await createTestUser("Stable");
    // Two repos, identical scores: `bestRepo` and `worstRepo` are pure ties, so the
    // `repo_name` tie-break is the only thing deciding which row wins.
    await seedAcrossPeriods(user.id, workspace.id, "stable_aaa", 4, 0);
    await seedAcrossPeriods(user.id, workspace.id, "stable_zzz", 4, 0);

    const now = Date.now();
    const args = [
      user.id,
      new Date(now - 30 * DAY),
      new Date(now - 60 * DAY),
      new Date(now),
    ] as const;

    const first = await shipped(...args);
    await expect(shipped(...args)).resolves.toEqual(first);
    await expect(shipped(...args)).resolves.toEqual(first);
    expect(first.bestRepo).toEqual({ name: "stable_aaa", score: 50 });
  });
});
