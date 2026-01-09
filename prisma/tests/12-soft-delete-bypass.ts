import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🪦 --- ТЕСТ 12: SOFT DELETE BYPASS ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const key = await assertSuccess(
    "Создание ключа",
    alice.db.apiKey.create({
      data: {
        name: "Key",
        prefix: "p_",
        hashedKey: "hash",
        userId: alice.user.id,
      },
    })
  );

  await assertSuccess("Soft delete", alice.db.apiKey.delete({ where: { id: key.id } }));

  await assertFail(
    "Попытка update удалённого ключа",
    alice.db.apiKey.update({
      where: { id: key.id },
      data: { name: "HACK" },
    })
  );

  console.log("\n🏁 Soft-delete bypass закрыт!");
}

void main();
