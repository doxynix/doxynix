import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔗 --- ТЕСТ 6: НАСЛЕДОВАНИЕ ПРАВ (Analysis/Docs) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  const repo = await alice.db.repo.create({
    data: {
      url: "https://github.com/alice/nested",
      name: "nested-repo",
      owner: "alice",
      githubId: 555,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const analysis = await alice.db.analysis.create({
    data: {
      repoId: repo.id,
      status: "DONE",
      metricsJson: {},
      commitSha: "sha123",
      score: 100,
    },
  });

  await assertFail(
    "Боб пытается читать анализ приватного репо",
    bob.db.analysis.findUniqueOrThrow({
      where: { id: analysis.id },
    })
  );

  await assertSuccess(
    "Алиса читает свой анализ",
    alice.db.analysis.findUniqueOrThrow({
      where: { id: analysis.id },
    })
  );

  console.log("\n🏁 Тесты Nested пройдены!");
}

void main();
