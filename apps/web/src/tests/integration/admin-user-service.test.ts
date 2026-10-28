import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as authModule from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { adminUserService } from "@/server/modules/users/admin-user.service";

import { cleanupDatabase, createTestUser, expectDenied } from "../helpers";

// These run the service against a real `enhance()`-hardened client, so the assertions below are about
// what ZenStack's policies permit, not about what the service code assumes.
//
// The shared `cleanupDatabase` only drops users with test addresses, while `dxnx_web_test` may still
// hold rows left by a seed. `assertNotLastAdmin` counts admins globally, so the tests have to start
// from a known population or they measure the leftovers instead of their own fixtures.
async function resetUsers() {
  await cleanupDatabase();
  await prisma.user.deleteMany({});
}

// Ban and delete re-check an authenticator code through better-auth, which needs a real session cookie
// and an enrolled TOTP secret. The shape of the code is covered by `admin-access.test.ts`; here only
// the wiring matters, so verification is stubbed and asserted on separately.
const verifyTOTP = vi.hoisted(() => vi.fn().mockResolvedValue({ status: true }));

vi.mock("@/server/core/auth", async (importOriginal) => {
  const actual = await importOriginal<{ auth: typeof authModule.auth }>();

  return {
    auth: { ...actual.auth, api: { ...actual.auth.api, verifyTOTP } },
  };
});

const REAUTH = { headers: new Headers(), twoFactorEnabled: true };
const TOTP = "123456";

describe("adminUserService against ZenStack policies", () => {
  beforeEach(() => {
    verifyTOTP.mockReset();
    verifyTOTP.mockResolvedValue({ status: true });
  });

  it("lets an admin read every account and a plain user only their own", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");
    await createTestUser("Bob", "USER");

    const asAdmin = await adminUserService.getAll(admin.db, { limit: 100 });
    const asAlice = await adminUserService.getAll(alice.db, { limit: 100 });

    expect(asAdmin.items.map((item) => item.email)).toContain(alice.email);
    expect(asAdmin.meta.totalCount).toBe(await prisma.user.count());
    expect(asAlice.items).toHaveLength(1);
    expect(asAlice.items[0]?.id).toBe(alice.user.id);
  });

  it("ban and unban flow through the real User policy", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    const banned = await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      {
        banned: true,
        banReason: "spam",
        code: TOTP,
        id: bob.user.id,
      },
      REAUTH,
    );

    expect(banned.user).toMatchObject({ banned: true, banReason: "spam" });

    const readBack = await prisma.user.findUniqueOrThrow({ where: { id: bob.user.id } });
    expect(readBack.banned).toBe(true);

    const unbanned = await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      {
        banned: false,
        id: bob.user.id,
      },
      REAUTH,
    );

    // A stale expiry must not survive the un-ban, or the account stays locked out.
    expect(unbanned.user).toMatchObject({ banExpires: null, banned: false, banReason: null });
  });

  it("keeps the ban scoped to the row, sparing repos and API keys", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    const repo = await bob.db.repo.create({
      data: {
        createdByUserId: bob.user.id,
        githubId: 77,
        name: "spam-repo",
        owner: "bob",
        url: "https://github.com/bob/spam-repo",
        workspaceId: bob.workspace.id,
      },
    });
    await bob.db.apiKey.create({
      data: {
        hashedKey: "h",
        name: "k",
        prefix: "p",
        userId: bob.user.id,
        workspaceId: bob.workspace.id,
      },
    });

    await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      {
        banned: true,
        code: TOTP,
        id: bob.user.id,
      },
      REAUTH,
    );

    await expect(prisma.repo.findUniqueOrThrow({ where: { id: repo.id } })).resolves.toMatchObject({
      name: "spam-repo",
    });
    await expect(prisma.apiKey.count()).resolves.toBe(1);
  });

  it("lets only an admin change a role, and only while another admin survives", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const secondAdmin = await createTestUser("Second", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expect(
      adminUserService.setRole(bob.db, bob.user.id, { id: bob.user.id, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const promoted = await adminUserService.setRole(admin.db, admin.user.id, {
      id: bob.user.id,
      role: "ADMIN",
    });
    expect(promoted.user.role).toBe("ADMIN");

    // Both admins are still active, so demoting the actor back down is safe.
    const demoted = await adminUserService.setRole(admin.db, secondAdmin.user.id, {
      id: admin.user.id,
      role: "USER",
    });
    expect(demoted.user.role).toBe("USER");
  });

  it("refuses to demote or ban the last active admin", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expectDenied(
      adminUserService.setBanned(
        bob.db,
        bob.user.id,
        { banned: true, code: TOTP, id: admin.user.id },
        REAUTH,
      ),
    );

    await expect(
      adminUserService.setRole(admin.db, bob.user.id, { id: admin.user.id, role: "USER" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a ban whose expiry already passed", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expect(
      adminUserService.setBanned(
        admin.db,
        admin.user.id,
        {
          banExpires: new Date(Date.now() - 60_000),
          banned: true,
          code: TOTP,
          id: bob.user.id,
        },
        REAUTH,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("counts the relations a moderation decision depends on", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await bob.db.repo.create({
      data: {
        createdByUserId: bob.user.id,
        githubId: 5,
        name: "counted",
        owner: "bob",
        url: "https://github.com/bob/counted",
        workspaceId: bob.workspace.id,
      },
    });

    const detail = await adminUserService.getDetail(admin.db, bob.user.id);

    expect(detail.counts.repos).toBe(1);
    expect(detail.id).toBe(bob.user.id);
  });

  it("revokes the target's sessions on ban and spares the actor's own", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `bob-token-${Date.now()}`,
        userId: bob.user.id,
      },
    });
    await admin.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `admin-token-${Date.now()}`,
        userId: admin.user.id,
      },
    });

    await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      {
        banned: true,
        code: TOTP,
        id: bob.user.id,
      },
      REAUTH,
    );

    await expect(prisma.session.count({ where: { userId: bob.user.id } })).resolves.toBe(0);
    await expect(prisma.session.count({ where: { userId: admin.user.id } })).resolves.toBe(1);
  });

  it("lists another user's sessions and revokes one, sparing the rest", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    const first = await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        ipAddress: "203.0.113.7",
        token: `bob-one-${Date.now()}`,
        userAgent: "Mozilla/5.0",
        userId: bob.user.id,
      },
    });
    await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `bob-two-${Date.now()}`,
        userId: bob.user.id,
      },
    });

    const listed = await adminUserService.getSessions(admin.db, bob.user.id);
    expect(listed.items).toHaveLength(2);
    expect(listed.items.find((item) => item.id === first.id)).toMatchObject({
      expired: false,
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0",
    });

    await adminUserService.revokeSession(admin.db, first.id);

    await expect(prisma.session.count({ where: { userId: bob.user.id } })).resolves.toBe(1);
  });

  it("marks an expired session as expired rather than hiding it", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() - 60_000),
        token: `bob-stale-${Date.now()}`,
        userId: bob.user.id,
      },
    });

    const listed = await adminUserService.getSessions(admin.db, bob.user.id);
    expect(listed.items[0]?.expired).toBe(true);
  });

  it("never returns a session token, which would let the panel impersonate the user", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    const session = await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `bob-secret-${Date.now()}`,
        userId: bob.user.id,
      },
    });

    const listed = await adminUserService.getSessions(admin.db, bob.user.id);

    expect(JSON.stringify(listed)).not.toContain("bob-secret");
    expect(listed.items[0]).not.toHaveProperty("token");
    expect(listed.items[0]?.id).toBe(session.id);
  });

  it("reports a missing session as NOT_FOUND", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");

    await expect(
      adminUserService.revokeSession(admin.db, "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("keeps a plain user out of another account's sessions", async () => {
    await resetUsers();

    const alice = await createTestUser("Alice", "USER");
    const bob = await createTestUser("Bob", "USER");

    await bob.db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `bob-private-${Date.now()}`,
        userId: bob.user.id,
      },
    });

    const listed = await adminUserService.getSessions(alice.db, bob.user.id);
    expect(listed.items).toHaveLength(0);
  });

  it("refuses to ban without a confirmation code, so the dialog cannot be skipped", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expect(
      adminUserService.setBanned(
        admin.db,
        admin.user.id,
        { banned: true, id: bob.user.id },
        REAUTH,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: bob.user.id } }),
    ).resolves.toMatchObject({ banned: false });
    expect(verifyTOTP).not.toHaveBeenCalled();
  });

  it("refuses a ban when better-auth rejects the code, leaving the account untouched", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    verifyTOTP.mockRejectedValueOnce(new Error("INVALID_CODE"));

    await expect(
      adminUserService.setBanned(
        admin.db,
        admin.user.id,
        { banned: true, code: "000000", id: bob.user.id },
        REAUTH,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: bob.user.id } }),
    ).resolves.toMatchObject({ banned: false });
  });

  it("tells an admin with no authenticator enrolled why, instead of blaming the code", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expect(
      adminUserService.setBanned(
        admin.db,
        admin.user.id,
        { banned: true, code: TOTP, id: bob.user.id },
        { headers: new Headers(), twoFactorEnabled: false },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses to delete without a confirmation code", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await expect(
      adminUserService.deleteUser(admin.db, admin.user.id, { id: bob.user.id }, REAUTH),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(prisma.user.count({ where: { id: bob.user.id } })).resolves.toBe(1);
  });

  it("leaves an unban reachable without a code, so an admin can undo a mistake while locked out", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      { banned: true, code: TOTP, id: bob.user.id },
      REAUTH,
    );

    const unbanned = await adminUserService.setBanned(
      admin.db,
      admin.user.id,
      { banned: false, id: bob.user.id },
      { headers: new Headers(), twoFactorEnabled: false },
    );

    expect(unbanned.user.banned).toBe(false);
  });

  it("deletes through the policy and cascades to the owner's repos", async () => {
    await resetUsers();

    const admin = await createTestUser("Admin", "ADMIN");
    const bob = await createTestUser("Bob", "USER");

    await bob.db.repo.create({
      data: {
        createdByUserId: bob.user.id,
        githubId: 9,
        name: "doomed",
        owner: "bob",
        url: "https://github.com/bob/doomed",
        workspaceId: bob.workspace.id,
      },
    });

    await adminUserService.deleteUser(
      admin.db,
      admin.user.id,
      { code: TOTP, id: bob.user.id },
      REAUTH,
    );

    await expect(prisma.user.count({ where: { id: bob.user.id } })).resolves.toBe(0);
    await expect(prisma.repo.count()).resolves.toBe(0);
  });
});
