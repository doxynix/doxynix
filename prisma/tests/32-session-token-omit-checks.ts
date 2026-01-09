/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/shared/api/db/db";

import { cleanup, createTestUser } from "./utils";

async function main() {
  console.log("\n🔒 --- ТЕСТ 32: SESSION / TOKEN @omit CHECKS COMPLETION ---\n");
  await cleanup();

  const alice = await createTestUser("Alice");
  const id = `veri-${Date.now()}`;

  const session = await prisma.session.create({
    data: {
      sessionToken: "session_secret_tok",
      userId: alice.user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  const account = await prisma.account.create({
    data: {
      userId: alice.user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "prov_200",
      refresh_token: "REFRESH_SECRET",
      access_token: "ACCESS_SECRET",
      id_token: "ID_SECRET",
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: id,
      token: `VERI_SECRET-${Date.now()}`,
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

  const zAccount = await alice.db.account.findUnique({ where: { id: account.id } });
  if (
    (zAccount as any).refresh_token ||
    (zAccount as any).access_token ||
    (zAccount as any).id_token
  ) {
    console.error("❌ ПРОВАЛ: account tokens видны через ZenStack!");
    process.exit(1);
  } else {
    console.log("✅ access/refresh/id tokens скрыты.");
  }

  const zV = await alice.db.verificationToken.findFirst({
    where: { identifier: id },
  });
  if (zV && (zV as any).token) {
    console.error("❌ ПРОВАЛ: verification token виден!");
    process.exit(1);
  } else {
    console.log("✅ verification token скрыт.");
  }

  console.log("\n🏁 Тест Session/Token omit checks пройден!");
}

void main();
