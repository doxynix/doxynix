import type { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { adminUserService, assertNotActor, assertNotLastAdmin } from "./admin-user.service";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const OTHER_ID = "018f0000-0000-7000-8000-0000000000b2";

function captureError(run: () => void): TRPCError {
  try {
    run();
  } catch (error) {
    return error as TRPCError;
  }

  throw new Error("expected a throw");
}

describe("assertNotActor", () => {
  it("blocks an admin from acting on their own account", () => {
    expect(captureError(() => assertNotActor({ isSelf: true })).code).toBe("BAD_REQUEST");
  });

  it("allows acting on somebody else", () => {
    expect(() => assertNotActor({ isSelf: false })).not.toThrow();
  });
});

describe("assertNotLastAdmin", () => {
  it("blocks demoting or banning the only active admin, which would lock everyone out", () => {
    const error = captureError(() =>
      assertNotLastAdmin({ activeAdminCount: 1, isTargetAdmin: true }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toContain("only active admin");
  });

  it("allows demoting an admin when another one is still active", () => {
    expect(() => assertNotLastAdmin({ activeAdminCount: 2, isTargetAdmin: true })).not.toThrow();
  });

  it("does not consult the admin count when the target is not an admin", () => {
    expect(() => assertNotLastAdmin({ activeAdminCount: 0, isTargetAdmin: false })).not.toThrow();
  });
});

describe("adminUserService.buildWhereClause", () => {
  it("returns an empty clause for an unfiltered request, keeping the total-count shortcut honest", () => {
    expect(adminUserService.buildWhereClause({})).toEqual({});
  });

  it("passes role and banned filters straight through", () => {
    expect(adminUserService.buildWhereClause({ banned: false, role: "USER" })).toEqual({
      banned: false,
      role: "USER",
    });
  });

  it("searches name only, because email is encrypted and cannot be matched", () => {
    const clause = adminUserService.buildWhereClause({ search: "  Karen " });

    expect(clause.OR).toEqual([{ name: { contains: "karen", mode: "insensitive" } }]);
  });

  it("matches the id exactly when the search term is a uuid, so admins can paste one", () => {
    const clause = adminUserService.buildWhereClause({ search: USER_ID.toUpperCase() });

    expect(clause.OR).toContainEqual({ id: USER_ID });
  });

  it("never feeds a non-uuid term into the id filter, which Prisma would reject", () => {
    const clause = adminUserService.buildWhereClause({ search: "karen" });

    expect(clause.OR).not.toContainEqual({ id: "karen" });
  });

  it("ignores a blank search instead of matching everything", () => {
    expect(adminUserService.buildWhereClause({ search: "   " })).toEqual({});
  });

  it("keeps the filters independent of a search", () => {
    expect(adminUserService.buildWhereClause({ role: "ADMIN", search: "karen" })).toEqual({
      OR: [{ name: { contains: "karen", mode: "insensitive" } }],
      role: "ADMIN",
    });
  });
});

describe("adminUserService.setRole guards", () => {
  function makeDb(target: { role: string }, adminCount: number) {
    const update = vi.fn();

    const db = {
      user: {
        count: vi.fn().mockResolvedValue(adminCount),
        findUnique: vi.fn().mockResolvedValue({ id: OTHER_ID, role: target.role }),
        update,
      },
    };

    return { db, update };
  }

  it("refuses a self-demotion before touching the database", async () => {
    const { db, update } = makeDb({ role: "ADMIN" }, 3);

    await expect(
      adminUserService.setRole(db as never, OTHER_ID, { id: OTHER_ID, role: "USER" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a self-promotion too, which otherwise falls through to a bare policy violation", async () => {
    const { db, update } = makeDb({ role: "USER" }, 3);

    await expect(
      adminUserService.setRole(db as never, OTHER_ID, { id: OTHER_ID, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(update).not.toHaveBeenCalled();
  });

  it("refuses demoting the last admin and never reaches the update", async () => {
    const { db, update } = makeDb({ role: "ADMIN" }, 1);

    await expect(
      adminUserService.setRole(db as never, USER_ID, { id: OTHER_ID, role: "USER" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(update).not.toHaveBeenCalled();
  });

  it("promotes a plain user without counting admins, since the count cannot lose a member", async () => {
    const { db } = makeDb({ role: "USER" }, 1);
    db.user.update.mockResolvedValue({});

    await adminUserService.setRole(db as never, USER_ID, { id: OTHER_ID, role: "ADMIN" });

    expect(db.user.update).toHaveBeenCalledTimes(1);
    expect(db.user.count).not.toHaveBeenCalled();
  });
});
