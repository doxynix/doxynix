import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n⚔️ --- ТЕСТ 29: UNIQUE RACE (same user) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const githubId = 777777;

  const p1 = alice.db.repo.create({
    data: {
      name: "repo-1",
      url: "https://g.com/1",
      owner: "alice",
      githubId,
      userId: alice.user.id,
    },
  });

  const p2 = alice.db.repo.create({
    data: {
      name: "repo-2",
      url: "https://g.com/2",
      owner: "alice",
      githubId,
      userId: alice.user.id,
    },
  });

  const [r1, r2] = await Promise.allSettled([p1, p2]);

  const ok = [r1, r2].filter((r) => r.status === "fulfilled").length;
  const fail = [r1, r2].filter((r) => r.status === "rejected").length;

  if (ok === 1 && fail === 1) {
    console.log("✅ УСПЕХ: Unique constraint [githubId + userId] выдержал гонку.");
  } else {
    console.error("❌ ПРОВАЛ: Ожидался 1 успех и 1 отказ для одного юзера.");
    process.exit(1);
  }
}

void main();
