import { assertFail, cleanup, createTestUser } from "./utils";

async function main() {
  await cleanup();
  const alice = await createTestUser("Alice");

  await assertFail(
    "Попытка изменить publicId",
    alice.db.user.update({ where: { id: alice.user.id }, data: { publicId: "hacked" } })
  );

  await assertFail(
    "Попытка изменить createdAt",
    alice.db.user.update({ where: { id: alice.user.id }, data: { createdAt: new Date(0) } })
  );

  await assertFail(
    "Попытка изменить apiKey.hashedKey",
    alice.db.apiKey.update({
      where: { id: (await alice.db.apiKey.findFirst({ where: { userId: alice.user.id } }))?.id },
      data: { hashedKey: "bad" },
    })
  );

  console.log("✅ Immutable fields protected");
}
void main();
