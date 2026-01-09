import { enhance } from "@zenstackhq/runtime";

import { prisma } from "@/shared/api/db/db";

import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n👑 --- ТЕСТ 20: ADMIN WRITE (set role) ---\n");
  await cleanup();

  const admin = await createTestUser("Admin", "ADMIN");
  const alice = await createTestUser("Alice", "USER");
  const bob = await createTestUser("Bob", "USER");

  await assertSuccess(
    "Admin повышает роль Алисы до ADMIN",
    admin.db.user.update({
      where: { id: alice.user.id },
      data: { role: "ADMIN" },
    })
  );

  const aliceAdminDb = enhance(prisma, {
    user: { id: alice.user.id, role: "ADMIN" },
  });

  await assertSuccess(
    "Алиса (теперь админ) успешно повышает Боба",
    aliceAdminDb.user.update({
      where: { id: bob.user.id },
      data: { role: "ADMIN" },
    })
  );

  const bobUserDb = enhance(prisma, {
    user: { id: bob.user.id, role: "USER" },
  });

  await assertFail(
    "Боб (обычный юзер) пытается сбросить роль Алисе",
    bobUserDb.user.update({
      where: { id: alice.user.id },
      data: { role: "USER" },
    })
  );

  console.log("✅ УСПЕХ: Роли распределяются корректно.");
  console.log("\n🏁 Тест Admin Write пройден!");
}

void main();
