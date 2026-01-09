import { prisma } from "@/shared/api/db/db";

import { assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🧨 --- ТЕСТ 5: КАСКАДНОЕ УДАЛЕНИЕ ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const repo = await alice.db.repo.create({
    data: {
      name: "cascade-test",
      url: "https://github.com/alice/cascade-test",
      owner: "alice",
      githubId: 999,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await alice.db.apiKey.create({
    data: { name: "Key", prefix: "k", hashedKey: "h", userId: alice.user.id },
  });

  await alice.db.analysis.create({
    data: { repoId: repo.id, status: "NEW", metricsJson: {}, commitSha: "x" },
  });

  console.log("💣 Удаляем пользователя Алису...");
  await assertSuccess(
    "Удаление юзера",
    alice.db.user.delete({
      where: { id: alice.user.id },
    })
  );

  const repoCount = await prisma.repo.count();
  const keyCount = await prisma.apiKey.count();
  const analysisCount = await prisma.analysis.count();

  if (repoCount === 0 && keyCount === 0 && analysisCount === 0) {
    console.log("✅ УСПЕХ: Все данные пользователя каскадно удалены.");
  } else {
    console.error(`❌ ПРОВАЛ: Остались хвосты! Repos: ${repoCount}, Keys: ${keyCount}`);
    process.exit(1);
  }

  console.log("\n🏁 Тесты Cascade пройдены!");
}

void main();
