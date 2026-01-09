import { assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n📤 --- ТЕСТ 9: FIND MANY DATA LEAKAGE ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "alice-repo",
      url: "https://github.com/a/r",
      owner: "alice",
      githubId: 1,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const bobRepos = await assertSuccess("Bob делает findMany", bob.db.repo.findMany());

  if (bobRepos.length !== 0) {
    console.error("❌ ПРОВАЛ: Bob видит чужие репозитории через findMany");
    process.exit(1);
  }

  console.log("✅ УСПЕХ: findMany не сливает данные");

  console.log("\n🏁 FindMany тесты пройдены!");
}

void main();
