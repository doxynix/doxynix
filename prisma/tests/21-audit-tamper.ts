import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n📝 --- ТЕСТ 21: AUDIT LOG TAMPER RESISTANCE ---\n");
  await cleanup();

  const admin = await createTestUser("Admin", "ADMIN");
  const alice = await createTestUser("Alice", "USER");
  const bob = await createTestUser("Bob", "USER");

  const log = await assertSuccess(
    "Alice creates audit log",
    alice.db.auditLog.create({
      data: {
        model: "User",
        operation: "login",
        payload: { ok: true },
        userId: alice.user.id,
      },
    })
  );

  await assertFail(
    "Bob пытается обновить лог Алисы",
    bob.db.auditLog.update({
      where: { id: log.id },
      data: { payload: { tampered: true } },
    })
  );

  await assertFail(
    "Bob пытается удалить лог Алисы",
    bob.db.auditLog.delete({ where: { id: log.id } })
  );

  await assertSuccess(
    "Admin читает лог Алисы",
    admin.db.auditLog.findUniqueOrThrow({ where: { id: log.id } })
  );
  await assertSuccess(
    "Admin обновляет лог Алисы",
    admin.db.auditLog.update({ where: { id: log.id }, data: { payload: { auditedBy: "admin" } } })
  );

  console.log(
    "✅ УСПЕХ: Audit log защищён от посторонних изменений; admin может читать/модифицировать."
  );
  console.log("\n🏁 Тест Audit Tamper пройден!");
}

void main();
