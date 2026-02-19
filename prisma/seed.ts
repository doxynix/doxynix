// run: pnpm prisma db seed
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { DocType, PrismaClient, Status, Visibility } from "@prisma/client";
import pg from "pg";

import { DATABASE_URL } from "@/shared/constants/env.server";

const connectionString = DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MY_EMAIL = "karen.avakov2@gmail.com";

async function main() {
  console.log("Seeding data...");

  const user = await prisma.user.upsert({
    where: { email: MY_EMAIL },
    update: {},
    create: {
      email: MY_EMAIL,
      name: "Admin User",
      image: faker.image.avatar(),
      emailVerified: new Date(),
    },
  });

  console.log(`User ready: ${user.email} (ID: ${user.id})`);

  for (let i = 0; i < 12; i++) {
    const isReady = i < 6;
    const isPending = i >= 6 && i < 9;

    const randomScore = faker.number.int({ min: 60, max: 100 });
    const githubId = faker.number.int({ min: 1, max: 1000 });
    const owner = faker.internet.username();
    const repoName = faker.word.noun();

    const repo = await prisma.repo.create({
      data: {
        userId: user.id,
        githubId,
        owner: owner,
        name: repoName,
        url: `https://github.com/${owner}/${repoName}`,
        visibility: Math.random() > 0.5 ? Visibility.PUBLIC : Visibility.PRIVATE,

        analyses: {
          create: [
            {
              status: isReady ? Status.DONE : isPending ? Status.PENDING : Status.FAILED,
              commitSha: faker.git.commitSha(),
              score: isReady ? randomScore : null,
              metricsJson: isReady
                ? {
                    score: randomScore,
                    issues: faker.number.int({ min: 0, max: 20 }),
                    coverage: faker.number.int({ min: 30, max: 99 }),
                  }
                : {},
            },
          ],
        },

        documents: isReady
          ? {
              create: [
                {
                  version: "v1.0",
                  type: DocType.README,
                  content: "# Readme \n\n This is a generated file...",
                },
                {
                  version: "v1.0",
                  type: DocType.API,
                  content: JSON.stringify({ endpoint: "/api/test", method: "GET" }, null, 2),
                },
              ],
            }
          : undefined,
      },
    });

    console.log(`Created repo: ${repo.owner}/${repo.name}`);
  }

  console.log("Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
