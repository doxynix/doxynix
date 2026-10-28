import { describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { bannedEmailService } from "@/server/modules/banned-emails/banned-email.service";

import { cleanupDatabase, createTestUser } from "../helpers";

describe("bannedEmailService against ZenStack policies", () => {
  it("blocks and unblocks an address through the real BannedEmail policy", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    const created = await bannedEmailService.create(admin.db, {
      email: "Spam@Example.com",
      reason: "MANUAL",
    });

    expect(created).toMatchObject({ email: "spam@example.com", reason: "MANUAL" });

    await prisma.bannedEmail.findUniqueOrThrow({ where: { id: created.id } });

    await bannedEmailService.remove(admin.db, created.id);
    await expect(prisma.bannedEmail.count()).resolves.toBe(0);
  });

  it("refuses a plain user every write and read on the ban list", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const alice = await createTestUser("Alice", "USER");

    await bannedEmailService.create(admin.db, { email: "spam@example.com" });

    // Asserted by code: `handlePrismaError` rewrites ZenStack's P2004 into a generic BAD_REQUEST, so
    // the message alone cannot tell a policy denial apart from a real constraint failure.
    await expect(
      bannedEmailService.create(alice.db, { email: "other@example.com" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      bannedEmailService.remove(alice.db, "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d"),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // ZenStack filters the read rather than rejecting it, so a plain user sees an empty list.
    const asAlice = await bannedEmailService.getAll(alice.db, { limit: 10 });
    expect(asAlice.items).toHaveLength(0);
    expect(asAlice.meta.filteredCount).toBe(0);
  });

  it("normalizes on write so a plus-tagged alias cannot re-register", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    const created = await bannedEmailService.create(admin.db, {
      email: "  User+spam@GoogleMail.com ",
    });

    // The stored hash is what `assertEmailNotBanned` looks up, so the normalization has to happen here.
    await expect(
      prisma.bannedEmail.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ email: "user@gmail.com" });
  });

  it("refuses to store the same address twice", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    await bannedEmailService.create(admin.db, { email: "spam@example.com" });

    await expect(
      bannedEmailService.create(admin.db, { email: "SPAM@example.com" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("filters by reason and paginates", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    await bannedEmailService.create(admin.db, { email: "one@example.com", reason: "BOUNCED" });
    await bannedEmailService.create(admin.db, { email: "two@example.com", reason: "MANUAL" });

    const bounced = await bannedEmailService.getAll(admin.db, { limit: 10, reason: "BOUNCED" });
    expect(bounced.items).toHaveLength(1);
    expect(bounced.items[0]?.email).toBe("one@example.com");

    const all = await bannedEmailService.getAll(admin.db, { limit: 10 });
    expect(all.meta.filteredCount).toBe(2);
    expect(all.meta.totalCount).toBe(2);
  });

  // The whole point of the screen: a row created here has to change what better-auth accepts.
  // The fallback in `assertEmailNotBanned` re-derives the hash from the address whenever the stored
  // column is missing. If that derivation drifted from what the field-encryption extension writes, the
  // ban would silently stop matching instead of fail loudly.
  it("derives the same hash the extension wrote, so the missing-column fallback still matches", async () => {
    await cleanupDatabase();

    const { getNormalizedHash } = await import("@/server/utils/hash");
    const { email, user } = await createTestUser("Hashcheck", "USER");

    const stored = await prisma.$queryRaw<Array<{ email_hash: string | null }>>`
      SELECT email_hash FROM users WHERE id = ${user.id}::uuid
    `;

    expect(stored[0]?.email_hash).not.toBeNull();
    expect(getNormalizedHash(email)).toBe(stored[0]?.email_hash);
  });

  // An account ban used to send the link anyway: only `banned_emails` was consulted here, and
  // `user.banned` was not read until the link was clicked.
  it("stops a sign-in email for a banned account, which the session check alone left unblocked", async () => {
    await cleanupDatabase();

    const { auth } = await import("@/server/core/auth");
    const banned = await createTestUser("Accountban", "USER");

    await prisma.user.update({
      data: { banned: true, banReason: "abuse report" },
      where: { id: banned.user.id },
    });

    await expect(
      auth.api.signInMagicLink({ body: { email: banned.email }, headers: new Headers() }),
    ).rejects.toMatchObject({ message: "BANNED_USER" });
  });

  // An expired account ban must stop blocking, or the holder could not sign in to get unblocked.
  // Landing on the disposable-address guard rather than the ban gate is what proves the ban let them pass.
  it("lets an expired account ban past the ban gate", async () => {
    await cleanupDatabase();

    const { auth } = await import("@/server/core/auth");
    const expired = await createTestUser("Lapsed", "USER");

    await prisma.user.update({
      data: { banExpires: new Date(Date.now() - 60_000), banned: true },
      where: { id: expired.user.id },
    });

    await expect(
      auth.api.signInMagicLink({ body: { email: expired.email }, headers: new Headers() }),
    ).rejects.toMatchObject({ message: "EmailRejected" });
  });

  // An API key is verified without ever consulting the ban list, so revoking it at block time is the
  // only place this can be closed.
  it("revokes the account's API keys, which nothing else would block", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const { db, email, user, workspace } = await createTestUser("Keyed", "USER");

    await db.apiKey.create({
      data: {
        hashedKey: "hash-1",
        name: "ci",
        prefix: "dxnx_a",
        userId: user.id,
        workspaceId: workspace.id,
      },
    });
    await expect(prisma.apiKey.count({ where: { revoked: false } })).resolves.toBe(1);

    await bannedEmailService.create(admin.db, { email, reason: "MANUAL" });

    await expect(prisma.apiKey.count({ where: { revoked: true } })).resolves.toBe(1);
  });

  it("leaves another account's key alone", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const victim = await createTestUser("Victim", "USER");
    const bystander = await createTestUser("Bystander", "USER");

    for (const account of [victim, bystander]) {
      await account.db.apiKey.create({
        data: {
          hashedKey: `hash-${account.user.id}`,
          name: "ci",
          prefix: "dxnx_a",
          userId: account.user.id,
          workspaceId: account.workspace.id,
        },
      });
    }

    await bannedEmailService.create(admin.db, { email: victim.email, reason: "MANUAL" });

    await expect(
      prisma.apiKey.count({ where: { revoked: false, userId: bystander.user.id } }),
    ).resolves.toBe(1);
  });

  // A block only bites at sign-in, so it has to cut sessions that are already open.
  it("revokes a live session when the address is blocked mid-session", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const { db, email, user } = await createTestUser("Live", "USER");

    await db.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        token: `live-${Date.now()}`,
        userId: user.id,
      },
    });

    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(1);

    await bannedEmailService.create(admin.db, { email, reason: "MANUAL" });

    await expect(prisma.session.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("leaves other accounts alone when one address is blocked", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const victim = await createTestUser("Victim", "USER");
    const bystander = await createTestUser("Bystander", "USER");

    for (const account of [victim, bystander]) {
      await account.db.session.create({
        data: {
          expiresAt: new Date(Date.now() + 3_600_000),
          token: `s-${account.user.id}`,
          userId: account.user.id,
        },
      });
    }

    await bannedEmailService.create(admin.db, { email: victim.email, reason: "MANUAL" });

    await expect(prisma.session.count({ where: { userId: victim.user.id } })).resolves.toBe(0);
    await expect(prisma.session.count({ where: { userId: bystander.user.id } })).resolves.toBe(1);
  });

  // The whole point of the fallback: a row with no hash column must still be blocked. Exercised through
  // `createSession`, because that is the path that actually calls `assertEmailNotBanned` — the
  // `/sign-in/email` guard hashes the submitted address itself and would pass either way.
  it("blocks session creation for an address whose user row has no stored hash", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const { email, user } = await createTestUser("Nohash", "USER");

    await bannedEmailService.create(admin.db, { email, reason: "MANUAL" });

    await prisma.$executeRaw`UPDATE users SET email_hash = NULL WHERE id = ${user.id}::uuid`;

    const row = await prisma.$queryRaw<Array<{ email_hash: string | null }>>`
      SELECT email_hash FROM users WHERE id = ${user.id}::uuid
    `;
    expect(row[0]?.email_hash).toBeNull();

    const { auth } = await import("@/server/core/auth");
    const authContext = await auth.$context;

    await expect(authContext.internalAdapter.createSession(user.id, false)).rejects.toThrow(
      /EmailBanned/,
    );
  });

  it("blocks session creation for a stored-hash address too, proving the hook is reached", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");
    const { email, user } = await createTestUser("Withhash", "USER");

    await bannedEmailService.create(admin.db, { email, reason: "MANUAL" });

    const row = await prisma.$queryRaw<Array<{ email_hash: string | null }>>`
      SELECT email_hash FROM users WHERE id = ${user.id}::uuid
    `;
    expect(row[0]?.email_hash).not.toBeNull();

    const { auth } = await import("@/server/core/auth");
    const authContext = await auth.$context;

    await expect(authContext.internalAdapter.createSession(user.id, false)).rejects.toThrow(
      /EmailBanned/,
    );
  });

  it("makes the address unusable for sign-in, which is what the admin panel exists to do", async () => {
    await cleanupDatabase();

    const admin = await createTestUser("Admin", "ADMIN");

    await bannedEmailService.create(admin.db, { email: "blocked@example.com", reason: "MANUAL" });

    const { auth } = await import("@/server/core/auth");

    // Asserted on the ban's own signal: an unbanned address fails sign-in for unrelated reasons
    // (no password provider is enabled), so "it threw" would prove nothing.
    await expect(
      auth.api.signInEmail({
        body: { email: "blocked@example.com", password: "irrelevant" },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({ message: "EmailBanned", status: "FORBIDDEN" });
  });
});
