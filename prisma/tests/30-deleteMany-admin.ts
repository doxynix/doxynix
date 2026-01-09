/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🗑️ --- ТЕСТ 30: deleteMany ADMIN semantics ---\n");
  await cleanup();

  const admin = await createTestUser("Admin", "ADMIN");
  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  // создаём репы для Alice и Bob
  await alice.db.repo.create({
    data: {
      name: "alice-dm-1",
      url: "https://github.com/alice/dm1",
      owner: "alice",
      githubId: 88001,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await bob.db.repo.create({
    data: {
      name: "bob-dm-1",
      url: "https://github.com/bob/dm1",
      owner: "bob",
      githubId: 88002,
      visibility: "PRIVATE",
      userId: bob.user.id,
    },
  });

  await alice.db.repo.deleteMany({});
  const stillBob = await prisma.repo.findFirst({ where: { userId: bob.user.id } });
  if (!stillBob) {
    console.error("❌ ПРОВАЛ: Non-admin удалил чужой репо через deleteMany!");
    process.exit(1);
  } else {
    console.log("✅ Non-admin deleteMany не тронул чужие записи (ok).");
  }

  const resAdmin = await admin.db.repo.deleteMany({ where: { visibility: "PRIVATE" } });
  if ((resAdmin as any).count < 1) {
    console.error("❌ ПРОВАЛ: Admin deleteMany не удалил ожидаемые записи.");
    process.exit(1);
  } else {
    console.log(`✅ Admin успешно удалил ${(resAdmin as any).count} записей.`);
  }

  const remain = await prisma.repo.count();
  if (remain !== 0) {
    console.error(`❌ ПРОВАЛ: После admin deleteMany осталось ${remain} записей (ожидаем 0).`);
    process.exit(1);
  }

  console.log("\n🏁 Тест deleteMany-admin пройден!");
}

void main();
