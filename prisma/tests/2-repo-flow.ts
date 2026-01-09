/* eslint-disable @typescript-eslint/no-unused-vars */
import { assertFail, assertSuccess, cleanup, createAnon, createTestUser } from "./utils";

async function main() {
  console.log("\n📦 --- ТЕСТ 2: РЕПОЗИТОРИИ (Repo Flow) ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const bob = await createTestUser("Bob");
  const anon = createAnon();

  const privateRepo = await assertSuccess(
    "Алиса создает ПРИВАТНЫЙ репо",
    alice.db.repo.create({
      data: {
        name: "private-project",
        url: "https://github.com/alice/private",
        owner: "alice",
        githubId: 1001,
        visibility: "PRIVATE",
        userId: alice.user.id,
      },
    })
  );

  const publicRepo = await assertSuccess(
    "Алиса создает ПУБЛИЧНЫЙ репо",
    alice.db.repo.create({
      data: {
        name: "public-project",
        url: "https://github.com/alice/public",
        owner: "alice",
        githubId: 1002,
        visibility: "PUBLIC",
        userId: alice.user.id,
      },
    })
  );

  await assertFail(
    "Алиса создает дубликат (Unique)",
    alice.db.repo.create({
      data: {
        name: "duplicate",
        url: "https://github.com/alice/dup",
        owner: "alice",
        githubId: 1001,
        visibility: "PUBLIC",
        userId: alice.user.id,
      },
    })
  );

  await assertFail(
    "Алиса ставит отрицательные звезды (@gte)",
    alice.db.repo.update({
      where: { id: publicRepo.id },
      data: { stars: -5 },
    })
  );

  await assertFail(
    "Боб читает приватный репо Алисы",
    bob.db.repo.findUniqueOrThrow({
      where: { id: privateRepo.id },
    })
  );

  await assertSuccess(
    "Боб читает публичный репо",
    bob.db.repo.findUniqueOrThrow({
      where: { id: publicRepo.id },
    })
  );

  await assertFail("Боб удаляет репо Алисы", bob.db.repo.delete({ where: { id: privateRepo.id } }));

  await assertSuccess(
    "Алиса удаляет свой репо",
    alice.db.repo.delete({ where: { id: privateRepo.id } })
  );

  console.log("\n🏁 Тесты Repo пройдены!");
}

void main();
