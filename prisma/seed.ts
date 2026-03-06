// run: pnpm db:seed
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import pg from "pg";

import * as Fake from "../src/generated/fake-data";

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MY_EMAIL = "karen.avakov2@gmail.com";

async function main() {
  console.log("🚀 Starting seed with auto-generated fake data...");

  const admin = await prisma.user.upsert({
    create: {
      ...Fake.fakeUser(),
      email: MY_EMAIL,
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: "Karen Avakov",
      role: UserRole.ADMIN,
    },
    update: {},
    where: { email: MY_EMAIL },
  });
  console.log(`✅ Admin ready: ${admin.email}`);

  console.log("👥 Creating more users...");
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        ...Fake.fakeUser(),
        apiKeys: {
          create: [Fake.fakeApiKey(), Fake.fakeApiKey()],
        },
        email: faker.internet.email(),
        image: faker.image.avatar(),

        name: faker.person.fullName(),

        repos: {
          create: Array.from({ length: 3 }).map(() => ({
            ...Fake.fakeRepo(),
            analyses: {
              create: [
                {
                  ...Fake.fakeAnalysis(),
                  progress: 100,
                  score: faker.number.int({ max: 100, min: 1 }),
                  status: "DONE",
                },
                {
                  ...Fake.fakeAnalysis(),
                  progress: faker.number.int({ max: 99, min: 1 }),
                  status: "PENDING",
                },
              ],
            },
            description: faker.lorem.sentence(),
            documents: {
              create: [Fake.fakeDocument(), Fake.fakeDocument()],
            },
            forks: faker.number.int({ max: 5000 }),
            githubId: faker.number.int({ max: 100000000 }),
            name: faker.word.noun() + "-" + faker.string.alphanumeric(4),
            openIssues: faker.number.int({ max: 100 }),
            size: faker.number.int({ max: 100000 }),

            stars: faker.number.int({ max: 10000 }),

            url: faker.internet.url(),
          })),
        },
      },
    });
    console.log(`   - User created: ${user.name}`);
  }

  console.log("🔔 Creating notifications...");
  await prisma.notification.createMany({
    data: Array.from({ length: 10 }).map(() => ({
      ...Fake.fakeNotification(),
      isRead: faker.datatype.boolean(),
      userId: admin.id,
    })),
  });

  console.log("📝 Writing audit logs...");
  await prisma.auditLog.createMany({
    data: Array.from({ length: 20 }).map(() => ({
      ...Fake.fakeAuditLog(),
      ip: faker.internet.ip(),
      model: "Repo",
      operation: "CREATE",
      userId: admin.id,
    })),
  });

  console.log("✨ Seeding completed! Database is now full of life.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
