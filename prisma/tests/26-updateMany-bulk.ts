/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🧨 --- ТЕСТ 26: UPDATE_MANY / BULK OPERATION SAFETY ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "am1",
      url: "https://github.com/alice/am1",
      owner: "alice",
      githubId: 44001,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await alice.db.repo.create({
    data: {
      name: "am2",
      url: "https://github.com/alice/am2",
      owner: "alice",
      githubId: 44002,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  try {
    const res = await bob.db.repo.updateMany({ data: { visibility: "PUBLIC" } });
    if ((res as any).count && (res as any).count > 0) {
      console.error(
        `❌ ПРОВАЛ: Bob смог изменить ${(res as any).count} чужих записей через updateMany!`
      );
      process.exit(1);
    } else {
      console.log("✅ Bob updateMany вернул count 0 — bulk не повредил чужие записи.");
    }
  } catch (e: any) {
    console.log("✅ Bob updateMany упал (deny) — bulk protection сработал.", e?.message || "");
  }

  const delRes = await bob.db.repo.deleteMany({});
  if ((delRes as any).count !== 0) {
    console.error(`❌ ПРОВАЛ: Bob удалил ${(delRes as any).count} чужих записей через deleteMany!`);
    process.exit(1);
  } else {
    console.log("✅ Bob deleteMany не удалил чужие записи (count === 0).");
  }

  const still = await prisma.repo.findFirst({ where: { userId: alice.user.id } });
  if (!still) {
    console.error("❌ ПРОВАЛ: репо Алисы пропало после bulk-операции!");
    process.exit(1);
  }

  console.log("\n🏁 Тест UpdateMany/Bulk пройден!");
}

void main();
