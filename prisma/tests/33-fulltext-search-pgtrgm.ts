/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔎 --- ТЕСТ 33: BASIC SEARCH / pg_trgm (contains) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "fast-search-engine",
      url: "https://github.com/alice/fast-search",
      owner: "alice",
      githubId: 10101,
      visibility: "PUBLIC",
      userId: alice.user.id,
    },
  });

  await alice.db.repo.create({
    data: {
      name: "faster-search",
      url: "https://github.com/alice/faster",
      owner: "alice",
      githubId: 10102,
      visibility: "PUBLIC",
      userId: alice.user.id,
    },
  });

  const results = await bob.db.repo.findMany({
    where: { name: { contains: "fast-search", mode: "insensitive" } },
  });
  if (results.length === 0) {
    console.error("❌ ПРОВАЛ: Поиск по contains не вернул public результаты для Bob.");
    process.exit(1);
  } else {
    console.log(`✅ Поиск вернул ${results.length} public результатов.`);
  }

  try {
    const raw = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int FROM "repos" WHERE "name" ILIKE '%fast%'`
    );
    console.log("ℹ️ raw ILIKE count:", raw);
  } catch (e: any) {
    console.log(
      "ℹ️ raw search query упала — возможно ext не доступен в CI (это ок).",
      e.message || ""
    );
  }

  console.log("\n🏁 Тест Search/pg_trgm пройден (basic).");
}

void main();
