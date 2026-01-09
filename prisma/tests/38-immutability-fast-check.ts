/* eslint-disable @typescript-eslint/no-explicit-any */
import { enhance } from "@zenstackhq/runtime";
import fc from "fast-check";

import { prisma } from "@/shared/api/db/db";

import { cleanup } from "./utils";

const isStryker = process.env.STRYKER_MUTATOR === "true";

async function main() {
  console.log("\n💎 --- ТЕСТ 38: FIELD IMMUTABILITY (Fast-Check) ---\n");
  await cleanup();

  const user = await prisma.user.create({
    data: { name: "Alice", email: "alice@test.com", role: "USER" },
  });
  const db = enhance(prisma, { user: { id: user.id, role: "USER" } });

  await fc.assert(
    fc.asyncProperty(
      fc.uuid(),
      fc.date({
        min: new Date("1900-01-01T00:00:00.000Z"),
        max: new Date("2100-12-31T23:59:59.999Z"),
      }),
      async (fakeUuid, fakeDate) => {
        try {
          await db.user.update({
            where: { id: user.id },
            data: {
              publicId: fakeUuid as any,
              createdAt: fakeDate as any,
            },
          });

          const updated = await prisma.user.findUnique({ where: { id: user.id } });
          return (
            updated?.publicId === user.publicId &&
            updated?.createdAt.getTime() === user.createdAt.getTime()
          );
        } catch {
          return true;
        }
      }
    ),
    { numRuns: isStryker ? 2 : 100 }
  );

  console.log("✅ [Fast-Check]: System fields are immutable.");
}

main().catch(console.error);
