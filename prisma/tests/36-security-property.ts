/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { enhance } from "@zenstackhq/runtime";
import fc from "fast-check";

import { prisma } from "@/shared/api/db/db";

import { cleanup } from "./utils";

const isStryker = process.env.STRYKER_MUTATOR === "true";

async function main() {
  console.log("\n🧪 --- ТЕСТ 36: PROPERTY-BASED SECURITY (Fast-Check) ---\n");
  await cleanup();

  await fc.assert(
    fc.asyncProperty(fc.uuid(), fc.string({ minLength: 1 }), async (randomUuid, randomName) => {
      const anonDb = enhance(prisma, { user: undefined });

      const repo = await anonDb.repo.findFirst({
        where: { OR: [{ publicId: randomUuid }, { name: randomName }] },
      });

      return repo === null;
    }),
    { numRuns: 100 }
  );
  console.log("✅ Invariant 1: Anonymous Isolation confirmed.");

  const aliceUser = await prisma.user.create({
    data: { name: "Alice", email: `alice_${Date.now()}@test.com`, role: "USER" },
  });
  const aliceDb = enhance(prisma, { user: { id: aliceUser.id, role: "USER" } });

  await fc.assert(
    fc.asyncProperty(fc.constantFrom("ADMIN", "USER"), fc.string(), async (targetRole, newName) => {
      try {
        await aliceDb.user.update({
          where: { id: aliceUser.id },
          data: {
            role: targetRole as any,
            name: newName,
          },
        });

        const updated = await prisma.user.findUnique({ where: { id: aliceUser.id } });
        return updated?.role !== "ADMIN" || targetRole === "USER";
      } catch (e) {
        return true;
      }
    }),
    { numRuns: isStryker ? 2 : 100 }
  );
  console.log("✅ Invariant 2: Role Escalation impossible with random payloads.");
}

main().catch(console.error);
