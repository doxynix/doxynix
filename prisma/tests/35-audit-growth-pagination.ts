import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n📈 --- ТЕСТ 35: AUDIT LOG GROWTH & PAGINATION ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const batch = Array.from({ length: 120 }, (_, i) => ({
    model: "Repo",
    operation: "update",
    payload: { seq: i },
    userId: alice.user.id,
  }));

  for (const item of batch) {
    await alice.db.auditLog.create({ data: item });
  }

  const page1 = await alice.db.auditLog.findMany({
    where: { userId: alice.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const page2 = await alice.db.auditLog.findMany({
    where: { userId: alice.user.id },
    orderBy: { createdAt: "desc" },
    skip: 50,
    take: 50,
  });
  const page3 = await alice.db.auditLog.findMany({
    where: { userId: alice.user.id },
    orderBy: { createdAt: "desc" },
    skip: 100,
    take: 50,
  });

  if (page1.length !== 50 || page2.length !== 50 || page3.length !== 20) {
    console.error("❌ ПРОВАЛ: pagination counts unexpected", {
      p1: page1.length,
      p2: page2.length,
      p3: page3.length,
    });
    process.exit(1);
  }

  if (page1[0].createdAt < page1[page1.length - 1].createdAt) {
    console.error("❌ ПРОВАЛ: ordering incorrect for audit logs");
    process.exit(1);
  }

  console.log("✅ УСПЕХ: Audit log growth & pagination работает (basic).");
  console.log("\n🏁 Тест Audit Growth пройден!");
}

void main();
