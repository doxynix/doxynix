import { prisma } from "@/shared/api/db/db";

import { cleanup } from "./utils";

async function main() {
  console.log("🧹 Полная очистка базы...");
  await cleanup();
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.repo.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: "@test.com" } } });

  console.log("База очищена!");
}

main().catch(console.error);
