import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🛡️ --- ТЕСТ 4: АДМИН И АУДИТ ---\n");
  await cleanup();

  const admin = await createTestUser("Admin", "ADMIN");
  const alice = await createTestUser("Alice", "USER");
  const bob = await createTestUser("Bob", "USER");

  await assertFail(
    "USER не может повысить себе роль",
    alice.db.user.update({
      where: { id: alice.user.id },
      data: { role: "ADMIN" },
    })
  );

  const log = await assertSuccess(
    "Алиса создает лог",
    alice.db.auditLog.create({
      data: { model: "User", operation: "login", payload: {}, userId: alice.user.id },
    })
  );

  await assertSuccess(
    "Алиса читает свой лог",
    alice.db.auditLog.findUniqueOrThrow({
      where: { id: log.id },
    })
  );

  await assertFail(
    "Боб читает лог Алисы (Denied)",
    bob.db.auditLog.findUniqueOrThrow({
      where: { id: log.id },
    })
  );

  await assertSuccess(
    "Админ читает лог Алисы",
    admin.db.auditLog.findUniqueOrThrow({
      where: { id: log.id },
    })
  );

  console.log("\n🏁 Тесты Admin пройдены!");
}

void main();
