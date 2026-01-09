/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔒 --- ТЕСТ 22: @omit FIELDS ABSENCE CHECK ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");

  const key = await prisma.apiKey.create({
    data: { name: "omittest", prefix: "om_", hashedKey: "SECRET_OMIT", userId: alice.user.id },
  });

  const zKey = await alice.db.apiKey.findUnique({ where: { id: key.id } });

  if ((zKey as any).hashedKey) {
    console.error("❌ ПРОВАЛ: @omit hashedKey виден через ZenStack!");
    process.exit(1);
  } else {
    console.log("✅ hashedKey скрыт.");
  }

  const session = await prisma.session.create({
    data: {
      sessionToken: "sess_tok_123",
      userId: alice.user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });
  const zSession = await alice.db.session.findUnique({ where: { id: session.id } });

  if ((zSession as any).sessionToken) {
    console.error("❌ ПРОВАЛ: sessionToken виден через ZenStack!");
    process.exit(1);
  } else {
    console.log("✅ sessionToken скрыт.");
  }

  const account = await prisma.account.create({
    data: {
      userId: alice.user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "prov_1",
      refresh_token: "r_t",
      access_token: "a_t",
      id_token: "i_t",
    },
  });

  const zAccount = await alice.db.account.findUnique({ where: { id: account.id } });
  if (
    (zAccount as any).refresh_token ||
    (zAccount as any).access_token ||
    (zAccount as any).id_token
  ) {
    console.error("❌ ПРОВАЛ: one of tokens is visible via ZenStack!");
    process.exit(1);
  } else {
    console.log("✅ account tokens скрыты.");
  }

  console.log("\n🏁 Тест @omit полей пройден!");
}

void main();
