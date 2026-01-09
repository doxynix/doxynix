import { prisma } from "@/shared/api/db/db";

import { assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n⚡ --- ТЕСТ 19: CONCURRENCY UPDATE (increment stars) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const repo = await alice.db.repo.create({
    data: {
      name: "concurrent-stars",
      url: "https://github.com/alice/concurrent-stars",
      owner: "alice",
      githubId: 9009,
      visibility: "PRIVATE",
      userId: alice.user.id,
      stars: 0,
    },
  });

  const inc1 = prisma.repo.update({
    where: { id: repo.id },
    data: { stars: { increment: 1 } },
  });
  const inc2 = prisma.repo.update({
    where: { id: repo.id },
    data: { stars: { increment: 1 } },
  });

  await assertSuccess("Первый инкремент", inc1);
  await assertSuccess("Второй инкремент", inc2);

  const final = await prisma.repo.findUnique({ where: { id: repo.id } });
  if (!final) {
    console.error("❌ ПРОВАЛ: репо не найдено после инкрементов");
    process.exit(1);
  }

  if (final.stars !== 2) {
    console.error(`❌ ПРОВАЛ: ожидаем stars = 2, получили ${final.stars}`);
    process.exit(1);
  }

  console.log("✅ УСПЕХ: concurrent increments корректно добавились (stars === 2).");
  console.log("\n🏁 Тест Concurrency Update пройден!");
}

void main();
