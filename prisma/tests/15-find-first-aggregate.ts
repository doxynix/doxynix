/* eslint-disable @typescript-eslint/no-explicit-any */
import { cleanup, createTestUser } from "./utils";

async function main() {
  await cleanup();
  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await alice.db.repo.create({
    data: {
      name: "x",
      url: "https://github.com/alice/private",
      owner: "alice",
      githubId: 2000,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const first = await bob.db.repo.findFirst();
  if (first) {
    console.error("❌ Bob see private repo via findFirst");
    process.exit(1);
  }

  const agg = await bob.db.repo.aggregate({ _count: true });
  if ((agg as any)._count !== 0) {
    console.error("❌ Bob gets count via aggregate");
    process.exit(1);
  }

  console.log("✅ findFirst/aggregate sealed");
}
void main();
