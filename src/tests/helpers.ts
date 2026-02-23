import { enhance } from "@zenstackhq/runtime";
import { expect } from "vitest";

import { prisma } from "@/shared/api/db/db";

export async function cleanupDatabase() {
  const tablenames = [
    "audit_logs",
    "documents",
    "analyses",
    "api_keys",
    "repos",
    "accounts",
    "sessions",
    "verification_tokens",
  ];

  try {
    for (const table of tablenames) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { contains: "@test.com" } }, { email: { contains: "@git.hub" } }],
      },
    });
  } catch (error) {
    console.warn("Cleanup warning (might be foreign key race):", error);
  }
}

export async function createTestUser(name: string, role: "USER" | "ADMIN" = "USER") {
  const email = `${name.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`;
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
  await expect(promise).rejects.toThrowError(
    /denied|P2004|P2025|not found|unique constraint|result is not allowed to be read back/i
  );
}

export async function expectValidationFail(promise: Promise<any>) {
  await expect(promise).rejects.toThrowError(
    /validation|P2002|argument|value out of range|invalid url|Unique constraint failed/i
  );
}
