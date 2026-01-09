/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🗑️ --- ТЕСТ 23: DELETE_MANY SAFETY ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "alice-delete-test",
      url: "https://github.com/alice/deltest",
      owner: "alice",
      githubId: 10000,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await assertFail(
    "Bob делает updateMany (expect denied)",
    bob.db.repo.updateMany({ data: { visibility: "PUBLIC" } })
  );

  const res = await assertSuccess("Bob делает deleteMany", bob.db.repo.deleteMany({}));

  if ((res as any).count !== 0) {
    console.error(`❌ ПРОВАЛ: Bob удалил ${(res as any).count} объектов чужих!`);
    process.exit(1);
  } else {
    console.log("✅ УСПЕХ: deleteMany от non-admin не удалил чужие записи (count === 0).");
  }

  const still = await prisma.repo.findFirst({
    where: { userId: alice.user.id, name: "alice-delete-test" },
  });
  if (!still) {
    console.error("❌ КРИТИЧЕСКИЙ ПРОВАЛ: репо Алисы было удалено!");
    process.exit(1);
  }

  console.log("\n🏁 Тест deleteMany safety пройден!");
}

void main();
