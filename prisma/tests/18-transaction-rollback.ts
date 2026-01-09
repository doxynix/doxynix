/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔁 --- ТЕСТ 18: TRANSACTION ROLLBACK ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const repoName = "tx-rollback-repo";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.repo.create({
        data: {
          name: repoName,
          url: "https://github.com/alice/tx-rollback",
          owner: "alice",
          githubId: 8008,
          visibility: "PRIVATE",
          userId: alice.user.id,
        },
      });

      throw new Error("boom - force rollback");
    });
  } catch (e: any) {
    console.log("✅ Ожидаемая ошибка транзакции:", e.message);
  }

  const exists = await prisma.repo.findFirst({ where: { name: repoName } });
  if (exists) {
    console.error("❌ ПРОВАЛ: Объект остался после rollback!");
    process.exit(1);
  }

  console.log("✅ УСПЕХ: Транзакция откатилась корректно.");
  console.log("\n🏁 Тест Transaction Rollback пройден!");
}

void main();
