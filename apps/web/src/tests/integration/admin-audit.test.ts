import { AuditModel, AuditOperation, MAX_PAGE } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";
import { adminAuditService } from "@/server/modules/audit-logs/admin-audit.service";

// shiki highlights through Next's `unstable_cache`, which has no incremental cache outside a request.
vi.mock("@/shared/lib/shiki", () => ({
  highlightCode: (code: string) => Promise.resolve(`<pre>${code}</pre>`),
}));

import { cleanupDatabase, createTestUser } from "../helpers";

async function seedLog(data: {
  model?: AuditModel;
  operation?: AuditOperation;
  requestId?: string;
  userId?: null | string;
}) {
  return prisma.auditLog.create({
    data: {
      model: data.model ?? AuditModel.Repo,
      operation: data.operation ?? AuditOperation.UPDATE,
      payload: { data: { name: "demo" } },
      requestId: data.requestId ?? null,
      userId: data.userId ?? null,
    },
  });
}

describe("adminAuditService against ZenStack policies", () => {
  // Every `createTestUser` writes its own `User` audit row, so the seeded `Repo` rows are told apart
  // by model rather than by count.
  it("shows an admin every actor's activity, not just their own", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");
    const bob = await createTestUser("Bob", "USER");

    await seedLog({ requestId: "alice-1", userId: alice.user.id });
    await seedLog({ requestId: "bob-1", userId: bob.user.id });

    const asAdmin = await adminAuditService.getAll(admin.db, { limit: 50, model: "Repo" });
    expect(asAdmin.items.map((item) => item.requestId)).toEqual(
      expect.arrayContaining(["alice-1", "bob-1"]),
    );
    expect(asAdmin.items).toHaveLength(2);

    const asAlice = await adminAuditService.getAll(alice.db, { limit: 50, model: "Repo" });
    expect(asAlice.items.map((item) => item.requestId)).not.toContain("bob-1");
  });

  it("filters by model, operation and actor", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");

    await seedLog({ model: "Repo", operation: AuditOperation.UPDATE, userId: alice.user.id });
    await seedLog({ model: "ApiKey", operation: AuditOperation.DELETE, userId: alice.user.id });

    const byModel = await adminAuditService.getAll(admin.db, { limit: 50, model: "Repo" });
    expect(byModel.items.every((item) => item.entityType === "Repository")).toBe(true);

    const byOperation = await adminAuditService.getAll(admin.db, {
      limit: 50,
      operation: AuditOperation.DELETE,
    });
    expect(byOperation.items.length).toBeGreaterThan(0);
    expect(byOperation.items.every((item) => item.actionTitle === "Deleted")).toBe(true);

    const byActor = await adminAuditService.getAll(admin.db, {
      actorId: admin.user.id,
      limit: 50,
      operation: AuditOperation.DELETE,
    });
    expect(byActor.items).toHaveLength(0);
  });

  it("filters by a date range", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    await prisma.auditLog.create({
      data: {
        createdAt: new Date("2026-01-01"),
        model: "Repo",
        operation: AuditOperation.UPDATE,
        payload: {},
        requestId: "january",
      },
    });
    await prisma.auditLog.create({
      data: {
        createdAt: new Date("2026-06-01"),
        model: "Repo",
        operation: AuditOperation.UPDATE,
        payload: {},
        requestId: "june",
      },
    });

    const january = await adminAuditService.getAll(admin.db, {
      from: new Date("2026-01-01"),
      limit: 50,
      to: new Date("2026-01-31"),
    });

    expect(january.items.map((item) => item.requestId)).toEqual(["january"]);
  });

  it("sorts newest first and breaks ties deterministically", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const tie = new Date("2026-01-01T00:00:00.000Z");

    await prisma.auditLog.create({
      data: {
        createdAt: tie,
        model: "Repo",
        operation: AuditOperation.UPDATE,
        payload: {},
        requestId: "tied",
      },
    });
    const newest = await prisma.auditLog.create({
      data: {
        createdAt: new Date("2026-02-01"),
        model: "Repo",
        operation: AuditOperation.UPDATE,
        payload: {},
        requestId: "newest",
      },
    });

    const result = await adminAuditService.getAll(admin.db, { limit: 50, model: "Repo" });

    expect(result.items[0]?.id).toBe(newest.id);
  });

  it("paginates without repeating or dropping a row", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    for (let index = 0; index < 7; index += 1) {
      await seedLog({ requestId: `req-${index}` });
    }

    const filter = { limit: 3, model: AuditModel.Repo, search: "req-" };
    const first = await adminAuditService.getAll(admin.db, { ...filter, page: 1 });
    const second = await adminAuditService.getAll(admin.db, { ...filter, page: 2 });
    const third = await adminAuditService.getAll(admin.db, { ...filter, page: 3 });

    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.requestId);

    expect(new Set(ids).size).toBe(7);
    expect(first.meta.totalPages).toBe(3);
    expect(third.meta.hasNextPage).toBe(false);
  });

  it("clamps a page beyond the end instead of erroring", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    await seedLog({});

    const result = await adminAuditService.getAll(admin.db, {
      limit: 10,
      model: "Repo",
      page: 999,
    });

    expect(result.items).toHaveLength(0);
    // Clamped to MAX_PAGE rather than rejected, and the empty page is reported as such.
    expect(result.meta.currentPage).toBe(MAX_PAGE);
  });

  it("renders another actor's payload for an admin, which the self-service view cannot do", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    const log = await seedLog({ userId: bob.user.id });

    const asAdmin = await adminAuditService.getPayloadHtml(admin.db, log.id);
    expect(asAdmin).toContain("demo");

    // The self-service variant scopes by `userId`, so it cannot serve this row to the admin.
    const { auditService } = await import("@/server/modules/audit-logs/audit.service");
    await expect(
      auditService.getLogPayloadHtml(admin.db, admin.user.id, log.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reads one entry by id and reports a missing one as not found", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const log = await seedLog({});

    const detail = await adminAuditService.getDetail(admin.db, log.id);
    expect(detail.id).toBe(log.id);

    await expect(
      adminAuditService.getDetail(admin.db, "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
