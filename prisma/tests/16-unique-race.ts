import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n⚔️ --- ТЕСТ 16: UNIQUE RACE (concurrent creates) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const githubId = 424242;

  const p1 = alice.db.repo.create({
    data: {
      name: "concurrent-1",
      url: "https://github.com/alice/concurrent-1",
      owner: "alice",
      githubId,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const p2 = alice.db.repo.create({
    data: {
      name: "concurrent-2",
      url: "https://github.com/alice/concurrent-2",
      owner: "alice",
      githubId,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const results = await Promise.allSettled([p1, p2]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  if (fulfilled.length !== 1 || rejected.length !== 1) {
    console.error(
      "❌ ПРОВАЛ: Ожидается 1 успех и 1 ошибка при конкурентном создании с одинаковым unique key."
    );
    console.error("Результаты:", results);
    process.exit(1);
  }

  console.log("✅ УСПЕХ: Unique constraint выдержал гонку (1 created, 1 failed).");
  console.log("\n🏁 Тест Unique Race пройден!");
}

void main();
