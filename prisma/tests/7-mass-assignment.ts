import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🚨 --- ТЕСТ 7: MASS ASSIGNMENT & ROLE ESCALATION ---\n");
  await cleanup();

  const alice = await createTestUser("Alice", "USER");

  await assertFail(
    "USER пытается повысить себе роль",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { role: "ADMIN" },
    })
  );

  await assertFail(
    "USER пытается выставить createdAt вручную",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { createdAt: new Date("2000-01-01") },
    })
  );

  await assertSuccess(
    "USER меняет разрешённое поле",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { name: "Alice Safe" },
    })
  );

  console.log("\n🏁 Mass Assignment тесты пройдены!");
}

void main();
