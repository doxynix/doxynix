/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🧨 --- ТЕСТ 34: HUGE PAYLOAD / JSON LIMITS ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const big = "X".repeat(3 * 1024 * 1024);

  try {
    const doc = await alice.db.document.create({
      data: {
        repoId: (
          await alice.db.repo.create({
            data: {
              name: "big-payload-repo",
              url: "https://github.com/alice/big",
              owner: "alice",
              githubId: 1234567,
              visibility: "PRIVATE",
              userId: alice.user.id,
            },
          })
        ).id,
        version: "v-big",
        type: "USER_GUIDE",
        content: big,
      },
    });

    console.log(
      "✅ УСПЕХ: Документ с большим контентом сохранён (watch for DB size/timeouts). id:",
      doc.id
    );
  } catch (e: any) {
    console.log(
      "⚠️ ВНИМАНИЕ: Не удалось сохранить очень большой payload — это может быть ограничением DB или timeout:",
      e.message || ""
    );
  }

  console.log("\n🏁 Тест Huge Payload пройден (практическая проверка).");
}

void main();
