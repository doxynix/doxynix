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
    create: {
      email: MY_EMAIL,
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: "Admin User",
    },
    update: {},
    where: { email: MY_EMAIL },
  });

  console.log(`User ready: ${user.email} (ID: ${user.id})`);

  for (let i = 0; i < 12; i++) {
    const isReady = i < 6;
    const isPending = i >= 6 && i < 9;

    const randomScore = faker.number.int({ max: 100, min: 60 });
    const githubId = faker.number.int({ max: 1000, min: 1 });
    const owner = faker.internet.username();
    const repoName = faker.word.noun();

    const repo = await prisma.repo.create({
      data: {
        analyses: {
          create: [
            {
              commitSha: faker.git.commitSha(),
              metricsJson: isReady
                ? {
                    coverage: faker.number.int({ max: 99, min: 30 }),
                    issues: faker.number.int({ max: 20, min: 0 }),
                    score: randomScore,
                  }
                : {},
              score: isReady ? randomScore : null,
              status: isReady ? Status.DONE : isPending ? Status.PENDING : Status.FAILED,
            },
          ],
        },
        documents: isReady
          ? {
              create: [
                {
                  content: "# Readme \n\n This is a generated file...",
                  type: DocType.README,
                  version: "v1.0",
                },
                {
                  content: JSON.stringify({ endpoint: "/api/test", method: "GET" }, null, 2),
                  type: DocType.API,
                  version: "v1.0",
                },
              ],
            }
          : undefined,
        githubId,
        name: repoName,
        owner: owner,
        url: `https://github.com/${owner}/${repoName}`,

        userId: user.id,

        visibility: Math.random() > 0.5 ? Visibility.PUBLIC : Visibility.PRIVATE,
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
