import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { auditService } from "@/server/modules/audit-logs/audit.service";

import { cleanupDatabase, createTestUser } from "../helpers";

describe("audit keyset pagination", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("returns every row exactly once when createdAt ties across page boundaries", async () => {
    const { db, user } = await createTestUser("paginator");
    const sameInstant = new Date("2026-01-01T00:00:00.000Z");

    await prisma.$transaction(
      Array.from({ length: 25 }, () =>
        prisma.auditLog.create({
          data: {
            createdAt: sameInstant,
            model: "Repo",
            operation: "update",
            payload: {},
            userId: user.id,
          },
        }),
      ),
    );

    const seen: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 10; page += 1) {
      const result = await auditService.getActivityLogs(db, user.id, {
        cursor,
        limit: 10,
      });
      seen.push(...result.items.map((item) => item.id));
      cursor = result.nextCursor;
      if (cursor == null) {
        break;
      }
    }

    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });
});
