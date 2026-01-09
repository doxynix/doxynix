/* eslint-disable */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n⚡ --- ТЕСТ 31: CONCURRENT DELETE vs UPDATE (owner vs attacker) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  const repo = await alice.db.repo.create({
    data: {
      name: "race-delete-update",
      url: "https://github.com/alice/race",
      owner: "alice",
      githubId: 99001,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const pDelete = bob.db.repo.delete({ where: { id: repo.id } }).catch((e: any) => e);
  const pUpdate = alice.db.repo
    .update({ where: { id: repo.id }, data: { description: "updated" } })
    .catch((e: any) => e);

  const [dResult, uResult] = await Promise.all([pDelete, pUpdate]);

  const final = await prisma.repo.findUnique({ where: { id: repo.id } });

  if (!final) {
    console.error("❌ ПРОВАЛ: Репо исчезло (удалено неверно)!");
    process.exit(1);
  }

  if (final?.description !== "updated") {
    console.error("❌ ПРОВАЛ: Update Алисы не применился корректно.");
    process.exit(1);
  }

  console.log("✅ УСПЕХ: concurrent delete (attacker) не помешал legitimate update.");
  console.log("\n🏁 Тест Concurrency Delete/Update пройден!");
}

void main();
