/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n📊 --- ТЕСТ 27: AGGREGATE / findFirst / groupBy LEAKAGE ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "agg1",
      url: "https://github.com/alice/agg1",
      owner: "alice",
      githubId: 55001,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });
  await alice.db.repo.create({
    data: {
      name: "agg2",
      url: "https://github.com/alice/agg2",
      owner: "alice",
      githubId: 55002,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const first = await bob.db.repo.findFirst();
  if (first) {
    console.error("❌ ПРОВАЛ: Bob увидел чужой репо через findFirst!");
    process.exit(1);
  } else {
    console.log("✅ findFirst не слил данные.");
  }

  const agg = await bob.db.repo.aggregate({ _count: true });
  if ((agg as any)._count && (agg as any)._count !== 0) {
    console.error("❌ ПРОВАЛ: Bob получил неверный aggregate count!");
    process.exit(1);
  } else {
    console.log("✅ aggregate вернул 0 для Bob.");
  }

  try {
    const grouped = await (bob.db.repo as any).groupBy({
      by: ["visibility"],
      _count: { _all: true },
    });
    const total = grouped.reduce((s: number, g: any) => s + (g._count?._all || 0), 0);
    if (total !== 0) {
      console.error("❌ ПРОВАЛ: Bob увидел данные через groupBy!");
      process.exit(1);
    } else {
      console.log("✅ groupBy не показал данных Bob'у.");
    }
  } catch (e: any) {
    console.log("ℹ️ groupBy упал/заблокирован для Bob (ok):", e?.message || "");
  }

  console.log("\n🏁 Тест Aggregate/Leakage пройден!");
}

void main();
