import { getTrends } from "@prisma/client/sql";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import { cleanupDatabase, createTestUser } from "../helpers";

const DAY = 86_400_000;

async function runTrendsUnderTimeZone(
  userId: string,
  startDate: Date,
  endDate: Date,
  repoId: string | null,
  timeZone: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL TimeZone = '${timeZone}'`);
    return tx.$queryRawTyped(getTrends(userId, startDate, endDate, repoId));
  });
}

async function seedRepoWithAnalyses(
  userId: string,
  workspaceId: string,
  label: string,
  dailyScores: number[],
) {
  const repo = await prisma.repo.create({
    data: {
      createdByUserId: userId,
      githubId: 800_000_000 + Math.floor(Math.random() * 100_000_000),
      name: label,
      owner: "org",
      url: `https://github.com/org/${label}`,
      workspaceId,
    },
  });

  const anchor = Date.UTC(2026, 9, 14, 22, 0, 0);
  for (const [offset, score] of dailyScores.entries()) {
    await prisma.analysis.create({
      data: {
        commitSha: `sha-${label}-${offset}`,
        createdAt: new Date(anchor - offset * DAY),
        repoId: repo.id,
        score,
        status: "DONE",
        updatedAt: new Date(),
      },
    });
  }

  return repo;
}

/** Rows past `cur_end`: what a zone-sensitive cast would pull back into the window. */
async function seedPastPeriodEnd(repoId: string, endDate: Date) {
  for (const offsetHours of [4, 12]) {
    await prisma.analysis.create({
      data: {
        commitSha: `sha-gap-${repoId.slice(0, 8)}-${offsetHours}`,
        createdAt: new Date(endDate.getTime() + offsetHours * 3_600_000),
        repoId,
        score: 42,
        status: "DONE",
        updatedAt: new Date(),
      },
    });
  }
}

describe("getTrends", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("returns identical rows under every session TimeZone", async () => {
    const { user, workspace } = await createTestUser("TrendsTimeZone");
    const repo = await seedRepoWithAnalyses(user.id, workspace.id, "tz_repo", [90, 80, 70, 60]);

    const endDate = new Date(Date.UTC(2026, 9, 14, 22, 0, 0));
    const startDate = new Date(endDate.getTime() - 7 * DAY);
    await seedPastPeriodEnd(repo.id, endDate);

    const utc = await runTrendsUnderTimeZone(user.id, startDate, endDate, null, "UTC");
    const tokyo = await runTrendsUnderTimeZone(user.id, startDate, endDate, null, "Asia/Tokyo");
    const losAngeles = await runTrendsUnderTimeZone(
      user.id,
      startDate,
      endDate,
      null,
      "America/Los_Angeles",
    );

    expect(tokyo).toEqual(utc);
    expect(losAngeles).toEqual(utc);
    expect(utc.length).toBeGreaterThan(0);
  });

  it("keeps the latest analysis of a repo-day and averages across repos", async () => {
    const { user, workspace } = await createTestUser("TrendsDaily");
    const repo = await seedRepoWithAnalyses(user.id, workspace.id, "daily_repo", [90, 80]);
    await seedRepoWithAnalyses(user.id, workspace.id, "other_repo", [50]);

    await prisma.analysis.create({
      data: {
        commitSha: "sha-daily-extra",
        createdAt: new Date(Date.UTC(2026, 9, 14, 12, 0, 0)),
        repoId: repo.id,
        score: 30,
        status: "DONE",
        updatedAt: new Date(),
      },
    });

    const rows = await runTrendsUnderTimeZone(
      user.id,
      new Date(Date.UTC(2026, 9, 1)),
      new Date(Date.UTC(2026, 9, 14, 22, 0, 0)),
      null,
      "UTC",
    );

    // `DISTINCT ON (repo_id, DATE(created_at))` keeps only the 22:00 analysis, so the day point is
    // AVG(90, 50) across the two repos — never the 12:00 analysis' 30.
    const onTheDay = rows.filter((row) => row.fullDate === "2026-10-14");
    expect(onTheDay).toHaveLength(1);
    expect(onTheDay[0]?.health).toBe(70);
  });

  it("scopes to the calling user and ignores another user's rows", async () => {
    const alice = await createTestUser("TrendsAlice");
    const bob = await createTestUser("TrendsBob");
    await seedRepoWithAnalyses(alice.user.id, alice.workspace.id, "alice_repo", [90, 80, 70]);
    await seedRepoWithAnalyses(bob.user.id, bob.workspace.id, "bob_repo", [10, 20, 30]);

    const rows = await runTrendsUnderTimeZone(
      alice.user.id,
      new Date(Date.UTC(2026, 9, 1)),
      new Date(Date.UTC(2026, 9, 14, 22, 0, 0)),
      null,
      "UTC",
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number(row.health)).toBeGreaterThanOrEqual(70);
    }
  });
});
