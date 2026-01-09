import { assertFail, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🕳️ --- ТЕСТ 8: NESTED WRITE ESCALATION ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await assertFail(
    "Алиса создаёт репо, но привязывает к Бобу через connect",
    alice.db.repo.create({
      data: {
        name: "evil-repo",
        url: "https://evil.com",
        owner: "alice",
        githubId: 666,
        visibility: "PRIVATE",
        user: {
          connect: { id: bob.user.id },
        },
      },
    })
  );

  console.log("\n🏁 Nested Write тесты пройдены!");
}

void main();
