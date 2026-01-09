/* eslint-disable */
import { enhance } from "@zenstackhq/runtime";

import { prisma } from "@/shared/api/db/db";

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export async function createTestUser(name: string, role: "USER" | "ADMIN" = "USER") {
  const email = `${name.toLowerCase()}_${Date.now()}@test.com`;
  const user = await prisma.user.create({
    data: { name, email, role },
  });
  const db = enhance(prisma, { user: { id: user.id, role: user.role } });
  return { user, db, email };
}

export function createAnon() {
  return { db: enhance(prisma, { user: undefined }) };
}

export async function cleanup() {
  console.log(`${C.gray}🧹 Очистка базы...${C.reset}`);
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.analysis.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.repo.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: "@test.com" } } });
}

export async function assertFail(actionName: string, promise: Promise<any>) {
  try {
    await promise;
    console.error(
      `${C.red}❌ ПРОВАЛ: Операция "${actionName}" должна была упасть, но прошла!${C.reset}`
    );
    process.exit(1);
  } catch (e: any) {
    const isDenied = e.message?.includes("denied") || e.code === "P2004" || e.code === "P2025";
    const isValidation = e.message?.includes("validation") || e.code === "P2002"; // P2002 - unique constraint

    if (isDenied || isValidation) {
      console.log(
        `${C.green}✅ УСПЕХ (Блок): "${actionName}" -> ${e.code || "Validation Error"}${C.reset}`
      );
    } else {
      console.log(`${C.yellow}⚠️  СТРАННАЯ ОШИБКА в "${actionName}": ${e.message}${C.reset}`);
    }
  }
}

export async function assertSuccess(actionName: string, promise: Promise<any>) {
  try {
    const result = await promise;
    console.log(`${C.green}✅ УСПЕХ (Вып.): "${actionName}"${C.reset}`);
    return result;
  } catch (e: any) {
    console.error(
      `${C.red}❌ ПРОВАЛ: Операция "${actionName}" упала с ошибкой: ${e.message}${C.reset}`
    );
    process.exit(1);
  }
}
