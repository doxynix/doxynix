import { enhance } from "@zenstackhq/runtime";
import { expect } from "vitest";

import { prisma } from "@/server/core/db";

/**
 * `cleanupDatabase` TRUNCATEs, so pointing it at a development database destroys
 * real data. Integration tests must therefore run against a disposable database:
 * CI provides `test_db`; locally set DATABASE_URL to something matching this.
 */
const DISPOSABLE_DATABASE_PATTERN = /test/i;

export async function assertDisposableDatabase() {
  // current_database() returns the internal `name` type, which Prisma cannot
  // deserialize, hence the explicit cast to text.
  const rows = await prisma.$queryRawUnsafe<Array<{ database_name: string }>>(
    "SELECT current_database()::text AS database_name;",
  );
  const databaseName = rows[0]?.database_name ?? "";

  if (!DISPOSABLE_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}": ` +
        "cleanupDatabase() truncates it. Point DATABASE_URL at a disposable " +
        'database whose name contains "test" (CI uses "test_db").',
    );
  }
}

export async function cleanupDatabase() {
  await assertDisposableDatabase();

  const tablenames = [
    "audit_logs",
    "documents",
    "analyses",
    "api_keys",
    "repos",
    "accounts",
    "sessions",
    "verification_tokens",
    "pull_request_analyses",
    "generated_fixes",
    "pull_request_comments",
    "chat_sessions",
    "chat_messages",
    "notifications",
  ];

  for (const table of tablenames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: { contains: "@test.com" } }, { email: { contains: "@git.hub" } }],
    },
  });
}

export async function createTestUser(name: string, role: "ADMIN" | "USER" = "USER") {
  const email = `${name.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 10_000)}@test.com`;
  const user = await prisma.user.create({
    data: { email, name, role },
  });
  const db = enhance(prisma, { user: { id: user.id, role: user.role } });
  return { db, email, user };
}

export function createAnon() {
  return { db: enhance(prisma, { user: undefined }) };
}

export async function expectDenied(promise: Promise<any>) {
  await expect(promise).rejects.toThrow(
    /denied|p2004|p2025|not found|unique constraint|result is not allowed to be read back/i,
  );
}

export async function expectValidationFail(promise: Promise<any>) {
  await expect(promise).rejects.toThrow(
    /validation|p2002|argument|value out of range|invalid url|unique constraint failed/i,
  );
}
