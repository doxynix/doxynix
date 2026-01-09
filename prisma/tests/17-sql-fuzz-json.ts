import { assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🧪 --- ТЕСТ 17: SQL-FUZZ & LARGE JSON for metricsJson ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const bigString = "A".repeat(1024 * 1024);
  const metrics = {
    long: bigString,
    nested: {
      arr: Array.from({ length: 2000 }, (_, i) => ({ idx: i, val: bigString.slice(0, 200) })),
    },
    sneaky: "1; DROP TABLE users; --' OR '1'='1",
  };

  const analysis = await assertSuccess(
    "Создание Analysis с большим metricsJson",
    alice.db.analysis.create({
      data: {
        repoId: (
          await alice.db.repo.create({
            data: {
              name: "big-json-repo",
              url: "https://github.com/alice/big-json",
              owner: "alice",
              githubId: 7001,
              visibility: "PRIVATE",
              userId: alice.user.id,
            },
          })
        ).id,
        status: "DONE",
        commitSha: "sha-big-json",
        metricsJson: metrics,
      },
    })
  );

  const fetched = await alice.db.analysis.findUnique({ where: { id: analysis.id } });
  if (!fetched || fetched.metricsJson == null) {
    console.error("❌ ПРОВАЛ: metricsJson не сохранился или не читается.");
    process.exit(1);
  }

  console.log("✅ УСПЕХ: Большой / suspicious JSON принят и читается (no crash).");
  console.log("\n🏁 Тест SQL-Fuzz/JSON пройден!");
}

void main();
