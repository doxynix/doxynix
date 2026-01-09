import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n👤 --- ТЕСТ 1: ПОЛЬЗОВАТЕЛИ (User Flow) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await assertSuccess(
    "Алиса меняет свое имя (Valid)",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { name: "Alice Wonderland" },
    })
  );

  await assertFail(
    "Боб пытается сменить имя Алисе (Denied)",
    bob.db.user.update({
      where: { id: alice.user.id },
      data: { name: "HACKED" },
    })
  );

  await assertFail(
    "Алиса ставит некорректный email (@email)",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { email: "not-valid-email" },
    })
  );

  await assertFail(
    "Алиса ставит пустое имя (@length)",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { name: "" },
    })
  );

  await assertFail(
    "Алиса пытается удалить Боба (Denied)",
    alice.db.user.delete({
      where: { id: bob.user.id },
    })
  );

  console.log("\n🏁 Тесты User пройдены!");
}

void main();
