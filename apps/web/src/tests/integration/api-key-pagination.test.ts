import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import type { DbClient } from "@/server/core/db";
import { prisma } from "@/server/core/db";
import { apiKeyService } from "@/server/modules/api-keys/api-key.service";

import { cleanupDatabase, createTestUser } from "../helpers";

const LIMIT = 2;
const MAX_PAGES = 10;

type Page = { items: Array<{ id: string; name: string }>; meta: { nextCursor?: string } };

async function collectPages(fetchPage: (cursor?: string) => Promise<Page>) {
  const names: string[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(cursor);
    names.push(...result.items.map((item) => item.name));

    if (result.meta.nextCursor == null) {
      // `page` is zero-based, so a walk that ends here used `page + 1` requests.
      return { names, pages: page + 1 };
    }

    cursor = result.meta.nextCursor;
  }

  throw new Error("the cursor walk did not terminate");
}

describe("apiKeyService active and archived pages", () => {
  const now = Date.now();
  const past = new Date(now - 3_600_000);
  const future = new Date(now + 3_600_000);

  let db: DbClient;
  let workspaceId: string;

  beforeAll(async () => {
    await cleanupDatabase();

    const ctx = await createTestUser("api_key_pages");
    db = ctx.db;
    workspaceId = ctx.workspace.id;

    const rows = [
      // Live: nothing revoked, nothing expiring.
      { expiresAt: null, name: "fresh", revoked: false, revokedAfter: null },
      // Live: the expiry is in the future.
      { expiresAt: future, name: "expiring", revoked: false, revokedAfter: null },
      // Dead: expired without being revoked.
      { expiresAt: past, name: "expired", revoked: false, revokedAfter: null },
      // Dead: revoked with no grace window.
      { expiresAt: null, name: "revoked", revoked: true, revokedAfter: null },
      // Live: revoked, but the rotation grace window is still open.
      { expiresAt: null, name: "grace-open", revoked: true, revokedAfter: future },
      // Dead: rotated and past the grace window.
      { expiresAt: null, name: "grace-closed", revoked: true, revokedAfter: past },
    ];

    await prisma.apiKey.createMany({
      data: rows.map((row, index) => ({
        ...row,
        createdAt: new Date(now - index * 1000),
        hashedKey: `hashed_${randomUUID()}`,
        name: row.name,
        prefix: "dxnx_page",
        scopes: [],
        userId: ctx.user.id,
        workspaceId,
      })),
    });
  });

  it("puts each lifecycle row on exactly one side of the split, across every page", async () => {
    const live = await collectPages((cursor) =>
      apiKeyService.list(db, workspaceId, { cursor, limit: LIMIT }),
    );
    const dead = await collectPages((cursor) =>
      apiKeyService.listArchived(db, workspaceId, { cursor, limit: LIMIT }),
    );

    expect(live.names.sort()).toStrictEqual(["expiring", "fresh", "grace-open"]);
    expect(dead.names.sort()).toStrictEqual(["expired", "grace-closed", "revoked"]);

    // Three matching rows at two per page is the smallest walk that needs a cursor.
    expect(live.pages).toBe(2);
    expect(dead.pages).toBe(2);
  });

  it("returns the older half only after the cursor is followed", async () => {
    const first = await apiKeyService.list(db, workspaceId, { limit: LIMIT });

    expect(first.items).toHaveLength(LIMIT);
    expect(first.meta.nextCursor).toBeTypeOf("string");

    const second = await apiKeyService.list(db, workspaceId, {
      cursor: first.meta.nextCursor,
      limit: LIMIT,
    });

    expect(second.items).toHaveLength(1);
    expect(second.meta.nextCursor).toBeUndefined();
    expect(new Set([...first.items, ...second.items].map((key) => key.name)).size).toBe(3);
  });

  it("keeps another workspace's keys out of both pages", async () => {
    const other = await createTestUser("api_key_pages_other");

    await prisma.apiKey.createMany({
      data: [
        {
          expiresAt: null,
          hashedKey: `hashed_${randomUUID()}`,
          name: "foreign-live",
          prefix: "dxnx_page",
          revoked: false,
          revokedAfter: null,
          scopes: [],
          userId: other.user.id,
          workspaceId: other.workspace.id,
        },
        {
          expiresAt: past,
          hashedKey: `hashed_${randomUUID()}`,
          name: "foreign-dead",
          prefix: "dxnx_page",
          revoked: false,
          revokedAfter: null,
          scopes: [],
          userId: other.user.id,
          workspaceId: other.workspace.id,
        },
      ],
    });

    const live = await collectPages((cursor) =>
      apiKeyService.list(db, workspaceId, { cursor, limit: LIMIT }),
    );
    const dead = await collectPages((cursor) =>
      apiKeyService.listArchived(db, workspaceId, { cursor, limit: LIMIT }),
    );

    expect(live.names).not.toContain("foreign-live");
    expect(dead.names).not.toContain("foreign-dead");
  });
});
