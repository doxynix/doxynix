import { AuditModel, AuditOperation, MAX_PAGE } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { cappedCount } from "@/server/utils/pagination";

import { cleanupDatabase, createTestUser } from "../helpers";

const CAP = MAX_PAGE * 10 + 1;

describe("cappedCount", () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  // `cappedCount` replaced a hand-written SQL counter that had to mirror `buildWhereClause`.
  // These assertions are what stand in for that mirror: below the cap the result must equal
  // Prisma's own exact count, so a filter added to a where-clause cannot silently diverge.
  it("is exact below the cap and saturates at it above", async () => {
    const ctx = await createTestUser("capped_counter");

    await prisma.auditLog.createMany({
      data: Array.from({ length: 40 }, () => ({
        model: AuditModel.GeneratedFix,
        operation: AuditOperation.CREATE,
        payload: {} as never,
        userId: ctx.user.id,
      })),
    });

    const countAll = (take: number) => prisma.auditLog.findMany({ select: { id: true }, take });

    // Measured as a delta: `cleanupDatabase` does not truncate `audit_logs`, so an absolute
    // count would depend on what other files left behind.
    const before = await prisma.auditLog.count();

    // Below CAP, so the capped count must be exact and agree with Prisma.
    await expect(cappedCount(countAll, CAP)).resolves.toBe(before);

    // Above CAP, so it saturates: 40 rows match this model, the cap is 10.
    await expect(
      cappedCount(
        (take) =>
          prisma.auditLog.findMany({
            select: { id: true },
            take,
            where: { model: AuditModel.GeneratedFix },
          }),
        10,
      ),
    ).resolves.toBe(10);
  });

  it("matches an exact count for every filter shape below the cap", async () => {
    const ctx = await createTestUser("capped_filters");

    const variants: { label: string; where: Prisma.AuditLogWhereInput }[] = [
      { label: "no filters", where: {} },
      { label: "model", where: { model: AuditModel.Analysis } },
      { label: "operation", where: { operation: AuditOperation.CREATE } },
      { label: "actor", where: { userId: ctx.user.id } },
      {
        label: "model + operation",
        where: { model: AuditModel.Analysis, operation: AuditOperation.CREATE },
      },
      { label: "date range", where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } },
      {
        // Mirrors production: `model` and `operation` are enums and accept equality only,
        // so the free-text term search narrows to `requestId`.
        label: "search on requestId",
        where: { requestId: { contains: "create", mode: "insensitive" as const } },
      },
      {
        label: "term matching nothing",
        where: { requestId: "zzz-definitely-not-present" },
      },
    ];

    for (const v of variants) {
      const capped = await cappedCount(
        (take) => prisma.auditLog.findMany({ select: { id: true }, take, where: v.where }),
        CAP,
      );
      const exact = await prisma.auditLog.count({ where: v.where });

      expect(capped, `${v.label}: capped under-reports`).toBeGreaterThanOrEqual(
        Math.min(exact, CAP),
      );
      expect(capped, `${v.label}: diverges from exact count`).toBe(exact);
    }
  });

  it("never reports more rows than actually match", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 40 }, () => ({
        model: AuditModel.ChatMessage,
        operation: AuditOperation.CREATE,
        payload: {} as never,
      })),
    });

    const capped = await cappedCount(
      (take) =>
        prisma.auditLog.findMany({
          select: { id: true },
          take,
          where: { model: AuditModel.ChatMessage },
        }),
      10_000,
    );
    const exact = await prisma.auditLog.count({ where: { model: AuditModel.ChatMessage } });

    expect(capped).toBe(exact);
    expect(capped).toBeLessThanOrEqual(exact);
  });
});
