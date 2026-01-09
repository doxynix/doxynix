/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔑 --- ТЕСТ 3: API KEYS & SOFT DELETE ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  const key = await assertSuccess(
    "Алиса создает ключ",
    alice.db.apiKey.create({
      data: {
        name: "Prod Key",
        prefix: "dxnx_",
        hashedKey: "SECRET_HASH_123",
        userId: alice.user.id,
      },
    })
  );

  const fetchedKey = await alice.db.apiKey.findUnique({ where: { id: key.id } });
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if ((fetchedKey as any).hashedKey) {
    console.error("❌ ПРОВАЛ: hashedKey виден! @omit не работает.");
    process.exit(1);
  } else {
    console.log("✅ УСПЕХ: hashedKey скрыт.");
  }

  await assertFail(
    "Боб ищет ключ Алисы",
    bob.db.apiKey.findUniqueOrThrow({ where: { id: key.id } })
  );

  await assertSuccess("Алиса удаляет ключ", alice.db.apiKey.delete({ where: { id: key.id } }));

  const foundZen = await alice.db.apiKey.findUnique({ where: { id: key.id } });
  if (foundZen) {
    console.error("❌ ПРОВАЛ: ZenStack видит удаленный ключ (должен быть deny read revoked)!");
    process.exit(1);
  }
  console.log("✅ УСПЕХ: ZenStack не видит удаленный ключ.");

  const foundRaw = await prisma.apiKey.findUnique({ where: { id: key.id } });
  if (foundRaw && foundRaw.revoked === true) {
    console.log("✅ УСПЕХ: В базе ключ есть и revoked=true.");
  } else {
    console.error("❌ ПРОВАЛ: Ключ удален физически или revoked!=true.");
    process.exit(1);
  }

  console.log("\n🏁 Тесты ApiKey пройдены!");
}

void main();
