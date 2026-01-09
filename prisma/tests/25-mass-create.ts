import { prisma } from "@/shared/api/db/db";

import { assertFail, assertSuccess, cleanup, createAnon, createTestUser } from "./utils";

async function main() {
  console.log("\n🧪 --- ТЕСТ 25: MASS-ASSIGNMENT ON CREATE (forbidden fields) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");
  const anon = createAnon();

  await assertFail(
    "Anon пытается создать User с role = ADMIN (mass-assignment)",
    anon.db.user.create({
      data: { name: "Evil", email: "evil@test.com", role: "ADMIN" },
    })
  );

  await assertFail(
    "Alice создаёт Repo с userId = Bob.id (assign to another user)",
    alice.db.repo.create({
      data: {
        name: "evil-repo",
        url: "https://github.com/alice/evil",
        owner: "alice",
        githubId: 33033,
        visibility: "PRIVATE",
        userId: bob.user.id,
      },
    })
  );

  await assertFail(
    "Alice создаёт ApiKey с revoked = true (mass-assign system flag)",
    alice.db.apiKey.create({
      data: {
        name: "danger",
        prefix: "dx_",
        hashedKey: "SOME_HASH",
        userId: alice.user.id,
        revoked: true,
      },
    })
  );

  await assertSuccess(
    "Alice создаёт корректный ApiKey (без forbidden полей)",
    alice.db.apiKey.create({
      data: { name: "ok-key", prefix: "ok_", hashedKey: "H", userId: alice.user.id },
    })
  );

  const raw = await prisma.user.create({
    data: { name: "rawUser", email: "raw@test.com", role: "ADMIN" },
  });
  if (raw === null) {
    console.error(
      "❌ ПРОВАЛ: raw create не сработал (ожидаем, что raw prisma всегда может создать)."
    );
    process.exit(1);
  } else {
    console.log(
      "ℹ️ raw prisma create удался (подтверждение, что ZenStack фильтры работают отдельно)."
    );
  }

  console.log(
    "\n🏁 Тест Mass-Assignment пройден (или показывает реальные пробелы если что-то провалилось)."
  );
}

void main();
