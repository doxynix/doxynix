import { assertFail, assertSuccess, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔗 --- ТЕСТ 28: NESTED CONNECT/CREATE ESCALATION (both directions) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  await assertFail(
    "Alice.create(repo) с nested user.connect на Bob (эскалация прав)",
    alice.db.repo.create({
      data: {
        name: "nested-evil",
        url: "https://github.com/alice/nested-evil",
        owner: "alice",
        githubId: 66001,
        visibility: "PRIVATE",
        user: { connect: { id: bob.user.id } },
      },
    })
  );

  const repo = await alice.db.repo.create({
    data: {
      name: "alice-repo-for-nested",
      url: "https://github.com/alice/nested-allowed",
      owner: "alice",
      githubId: 66002,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  await assertFail(
    "Bob.create(analysis) с repo.connect на alice.repo (should be denied)",
    bob.db.analysis.create({
      data: {
        repo: { connect: { id: repo.id } },
        status: "PENDING",
        commitSha: "sha-nested-2",
      },
    })
  );

  await assertSuccess(
    "Alice создаёт Document внутри своего repo (nested happy path)",
    alice.db.document.create({
      data: {
        repoId: repo.id,
        version: "v1",
        type: "README",
        content: "ok",
      },
    })
  );

  console.log("\n🏁 Тест Nested Connect/Create пройден!");
}

void main();
