/* eslint-disable @typescript-eslint/no-explicit-any */
import { enhance } from "@zenstackhq/runtime";
import fc from "fast-check";

import { prisma } from "@/shared/api/db/db";

import { cleanup } from "./utils";

const isStryker = process.env.STRYKER_MUTATOR === "true";

async function main() {
  console.log("\n🛸 --- ULTIMATE PROPERTY-BASED SECURITY TEST ---\n");
  await cleanup();
  const suffix = Date.now();
  const bobUser = await prisma.user.create({
    data: { name: "Bob", email: `bob_${suffix}@target.com` },
  });
  const bobRepo = await prisma.repo.create({
    data: { name: "secret", url: "h", owner: "bob", githubId: 123, userId: bobUser.id },
  });

  await fc.assert(
    fc.asyncProperty(
      fc.record({
        name: fc.string({ minLength: 1 }),
        email: fc.uuid().map((id) => `${id}@test.com`),
        role: fc.constantFrom("USER", "ADMIN" as const),
      }),
      fc.record({
        hackedName: fc.string(),
        hackedStars: fc.integer(),
      }),
      async (attackerData, attack) => {
        const user = await prisma.user.create({ data: attackerData });
        const db = enhance(prisma, { user: { id: user.id, role: user.role } });

        const seeSecret = await db.repo.findUnique({ where: { id: bobRepo.id } });
        if (seeSecret) return false;

        try {
          await db.repo.update({
            where: { id: bobRepo.id },
            data: { userId: user.id },
          });
          return false;
        } catch {
          /* ok */
        }

        if (attack.hackedStars < 0) {
          try {
            await db.repo.create({
              data: {
                ...attackerData,
                stars: attack.hackedStars,
                userId: user.id,
                githubId: fc.nat(),
                url: "https://github.com/alice/private",
                owner: "a",
              } as any,
            });
            return false;
          } catch {
            /* ok */
          }
        }

        return true;
      }
    ),
    { numRuns: isStryker ? 2 : 100 }
  );

  console.log("✅ [Fast-Check]: 100 random attack vectors blocked.");
}

main().catch(console.error);
