/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertFail, cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🕳️ --- ТЕСТ 24: NESTED CREATE ESCALATION ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");

  const alicesRepo = await alice.db.repo.create({
    data: {
      name: "nest-esc",
      url: "https://github.com/alice/nest-esc",
      owner: "alice",
      githubId: 11011,
      visibility: "PRIVATE",
      userId: alice.user.id,
    },
  });

  const bobsRepo = await bob.db.repo.create({
    data: {
      name: "bobs-project",
      url: "https://github.com/bob/1",
      owner: "bob",
      githubId: 12345,
      visibility: "PRIVATE",
      userId: bob.user.id,
    },
  });

  await assertFail(
    "Bob пытается создать Analysis, подключив чужое repo через connect",
    bob.db.analysis.create({
      data: {
        repo: { connect: { id: alicesRepo.id } },
        status: "PENDING",
        commitSha: "sha-nested",
      },
    })
  );

  await assertFail(
    "Alice пытается создать Document внутри Analysis с чужим repo (nested create с неправильным repoId)",
    alice.db.document
      .create({
        data: {
          repoId: bobsRepo.id,
          version: "v1",
          type: "README",
          content: "ok",
        },
      })
      .then(async (_: any) => {
        return alice.db.analysis.create({
          data: {
            repoId: bobsRepo.id,
            status: "NEW",
            commitSha: "sha2",
          },
        });
      })
  );

  console.log("✅ Nested create escalation checks выполнены (denied там, где должно быть).");
  console.log("\n🏁 Тест Nested Create Escalation пройден!");
}

void main();
