import type { UserRole } from "@prisma/client";
import { enhance } from "@zenstackhq/runtime";
import * as fc from "fast-check";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";

import { prisma } from "@/shared/api/db/db";
import { IS_CI } from "@/shared/constants/env.client";

import { cleanupDatabase } from "../helpers";

const NUM_RUNS = IS_CI ? 20 : 50;

describe("Property-Based Security Tests (Fast-Check)", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeAll(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should verify Anonymous Isolation (Invariant 1)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.string({ minLength: 1 }), async (randomUuid, randomName) => {
        const anonDb = enhance(prisma, { user: undefined });
        const repo = await anonDb.repo.findFirst({
          where: { OR: [{ publicId: randomUuid }, { name: randomName }] },
        });
        return repo == null;
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("should verify Role Escalation impossibility (Invariant 2)", async () => {
    const user = await prisma.user.create({
      data: { name: "Fuzzer", email: `fuzz_${Date.now()}@t.com` },
    });
    const db = enhance(prisma, { user: { id: user.id, role: "USER" } });

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("ADMIN", "USER"),
        fc.string(),
        async (targetRole, newName) => {
          try {
            await db.user.update({
              where: { publicId: user.publicId },
              data: { role: targetRole as UserRole, name: newName },
            });
            const updated = await prisma.user.findUnique({ where: { id: user.id } });
            return updated?.role !== "ADMIN" || targetRole === "USER";
          } catch {
            return true;
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it("should verify Field Immutability (Invariant 3)", async () => {
    const user = await prisma.user.create({
      data: { name: "Immutable", email: `im_${Date.now()}@t.com` },
    });
    const db = enhance(prisma, { user: { id: user.id, role: "USER" } });

    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.date(), async (fakeUuid, fakeDate) => {
        try {
          await db.user.update({
            where: { publicId: user.publicId },
            data: { publicId: fakeUuid, createdAt: fakeDate },
          });
          return false;
        } catch {
          return true;
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
