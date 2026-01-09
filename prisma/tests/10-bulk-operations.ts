import { prisma } from "@/shared/api/db/db";

import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🧨 --- ТЕСТ 10: BULK OPERATIONS ABUSE ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "alice-repo",
      url: "https://r",
      owner: "alice",
      githubId: 77,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await assertFail(
    "Bob делает updateMany (Ожидаем ошибку P2004)",
    bob.db.repo.updateMany({
      data: { visibility: "PUBLIC" },
    })
  );

  const deleteResult = await assertSuccess(
    "Bob делает deleteMany (Ожидаем успех с count: 0)",
    bob.db.repo.deleteMany({})
  );

  if (deleteResult.count !== 0) {
    console.error(`❌ ПРОВАЛ: Боб смог удалить ${deleteResult.count} чужих записей!`);
    process.exit(1);
  } else {
    console.log("✅ УСПЕХ: Боб вызвал deleteMany, но удалено 0 записей.");
  }

  const aliceRepoExists = await prisma.repo.findFirst({
    where: { userId: alice.user.id, name: "alice-repo" },
  });

  if (aliceRepoExists) {
    console.log("✅ УСПЕХ: Репозиторий Алисы не пострадал.");
  } else {
    console.error("❌ КРИТИЧЕСКИЙ ПРОВАЛ: Репозиторий Алисы был удален Бобом!");
    process.exit(1);
  }

  console.log("\n🏁 Bulk операции защищены!");
}

void main();
