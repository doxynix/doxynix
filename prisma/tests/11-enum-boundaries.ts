import { assertFail, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n📏 --- ТЕСТ 11: ENUM & BOUNDARIES ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const repo = await alice.db.repo.create({
    data: {
      name: "metrics",
      url: "https://m",
      owner: "alice",
      githubId: 9999,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await assertFail(
    "Score больше 100",
    alice.db.analysis.create({
      data: {
        repoId: repo.id,
        status: "DONE",
        score: 101,
        metricsJson: {},
        commitSha: "x",
      },
    })
  );

  await assertFail(
    "Score меньше 0",
    alice.db.analysis.create({
      data: {
        repoId: repo.id,
        status: "DONE",
        score: -1,
        metricsJson: {},
        commitSha: "x",
      },
    })
  );

  console.log("\n🏁 Boundary тесты пройдены!");
}

void main();
