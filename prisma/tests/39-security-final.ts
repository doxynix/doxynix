import { randomUUID } from "node:crypto";
import { enhance } from "@zenstackhq/runtime";
import fc from "fast-check";

import { prisma } from "@/shared/api/db/db";

import { cleanup } from "./utils";

const isStryker = process.env.STRYKER_MUTATOR === "true";

async function main() {
  console.log("\n🕵️  --- ТЕСТ 39: FINAL SECURITY AUDIT ---\n");

  try {
    await cleanup();
  } catch {}

  console.log("👉 1. Checking API Key Leakage & Revocation...");

  await fc.assert(
    fc.asyncProperty(fc.uuid(), fc.boolean(), async (randomPrefix, isRevoked) => {
      const runId = randomUUID();

      const victim = await prisma.user.create({
        data: { name: "Victim", email: `v-${runId}@test.com`, role: "USER" },
      });
      const hacker = await prisma.user.create({
        data: { name: "Hacker", email: `h-${runId}@test.com`, role: "USER" },
      });

      const victimDb = enhance(prisma, { user: { id: victim.id, role: "USER" } });
      const hackerDb = enhance(prisma, { user: { id: hacker.id, role: "USER" } });

      const uniqueHash = `hash_${runId}`;

      const apiKey = await prisma.apiKey.create({
        data: {
          name: "Critical Key",
          prefix: randomPrefix,
          hashedKey: uniqueHash,
          userId: victim.id,
          revoked: isRevoked,
        },
      });

      const stolenById = await hackerDb.apiKey.findUnique({ where: { id: apiKey.id } });
      const stolenByList = await hackerDb.apiKey.findFirst({ where: { userId: victim.id } });

      if (stolenById !== null || stolenByList !== null) {
        throw new Error("❌ CRITICAL: Hacker accessed another user's API Key!");
      }

      if (isRevoked) {
        const selfRead = await victimDb.apiKey.findUnique({ where: { id: apiKey.id } });
        if (selfRead !== null) {
          throw new Error("❌ CRITICAL: Owner could read their own REVOKED key!");
        }
      }

      return true;
    }),
    { numRuns: isStryker ? 5 : 100 }
  );
  console.log("✅ [API Keys]: Strict isolation verified.");

  console.log("\n👉 2. Checking Visibility Drift (Public -> Private)...");

  const anonDb = enhance(prisma, { user: undefined });

  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 5 }),
      fc.integer({ min: 1, max: 2147483647 }),
      async (repoName, randomGithubId) => {
        const runId = randomUUID();

        const owner = await prisma.user.create({
          data: { name: "Dev", email: `dev-${runId}@git.hub` },
        });

        const uniqueName = `${repoName}-${runId}`;

        const repo = await prisma.repo.create({
          data: {
            name: uniqueName,
            owner: "dev",
            githubId: randomGithubId,
            url: `https://github.com/dev/${uniqueName}`,
            visibility: "PUBLIC",
            userId: owner.id,
            analyses: {
              create: { status: "DONE", commitSha: "abc", score: 100 },
            },
            documents: {
              create: { version: "1.0", type: "README", content: "Secret info" },
            },
          },
          include: { analyses: true, documents: true },
        });

        const analysisId = repo.analyses[0].id;
        const docId = repo.documents[0].id;

        const publicAnalysis = await anonDb.analysis.findUnique({ where: { id: analysisId } });

        if (!publicAnalysis) {
          console.warn("Warning: Public analysis not visible to anon");
        }

        await prisma.repo.update({
          where: { id: repo.id },
          data: { visibility: "PRIVATE" },
        });

        const leakedAnalysis = await anonDb.analysis.findUnique({ where: { id: analysisId } });
        const leakedDoc = await anonDb.document.findUnique({ where: { id: docId } });

        if (leakedAnalysis !== null || leakedDoc !== null) {
          throw new Error(`❌ LEAK DETECTED: Content remained accessible! Repo: ${uniqueName}`);
        }

        return true;
      }
    ),
    { numRuns: isStryker ? 2 : 100 }
  );

  console.log("✅ [Data Privacy]: Visibility switch revokes access instantly.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
