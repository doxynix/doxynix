import { assertFail, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔒 --- TEST: NESTED ROLE ESCALATION ---\n");
  await cleanup();
  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await assertFail(
    "Алиса создаёт репо и пытается привязать его к Бобу через nested connect",
    alice.db.repo.create({
      data: {
        name: "evil",
        url: "https://x",
        owner: "alice",
        githubId: 7777,
        visibility: "PRIVATE",
        user: { connect: { id: bob.user.id } },
      },
    })
  );

  console.log("✅ Done");
}
void main();
