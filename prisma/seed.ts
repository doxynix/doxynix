// run: pnpm db:seed
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { NotifyType, PrismaClient, Status, UserRole, Visibility } from "@prisma/client";
import pg from "pg";

import * as Fake from "../src/generated/fake-data";

const DATABASE_URL = process.env.DATABASE_URL;
const LIGHT_USER_COUNT = 50;
const LIGHT_REPOS_PER_USER = 3;
const REPO_BATCH_SIZE = 500;
const NOTIFICATION_BATCH_SIZE = 500;
const MY_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.test";
const STRESS_USER_EMAIL = "search-benchmark@example.test";
const STRESS_USER_NAME = "Search Benchmark";
const STRESS_REPO_COUNT = parseSeedNumber(process.env.SEED_STRESS_REPOS, 0);
const STRESS_NOTIFICATION_COUNT = parseSeedNumber(process.env.SEED_STRESS_NOTIFICATIONS, 0);

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function clean<T>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;
}

function parseSeedNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid seed count: "${value}". Expected a positive integer.`);
  }

  return Number(trimmed);
}

function createStressRepo(index: number, userId: number) {
  const ownerPool = ["vercel", "facebook", "microsoft", "tanstack", "nestjs", "vuejs", "angular"];
  const topicPool = ["react", "typescript", "nextjs", "nodejs", "graphql", "postgres", "prisma"];
  const owner = ownerPool[index % ownerPool.length]!;
  const primaryTopic = topicPool[index % topicPool.length]!;
  const secondaryTopic = topicPool[(index + 1) % topicPool.length]!;
  const name = index % 9 === 0 ? `react-query-bench-${index}` : `${primaryTopic}-bench-${index}`;
  const description =
    index % 4 === 0
      ? `Benchmark repository ${index} for react query search and GitHub-style substring matching`
      : `Benchmark repository ${index} for ${owner} with ${primaryTopic} and ${secondaryTopic}`;

  return clean({
    ...Fake.fakeRepo(),
    createdAt: faker.date.recent({ days: 90 }),
    defaultBranch: "main",
    description,
    forks: faker.number.int({ max: 5000 }),
    githubCreatedAt: faker.date.past({ years: 3 }),
    githubId: 900_000_000 + index,
    language: index % 3 === 0 ? "TypeScript" : index % 3 === 1 ? "JavaScript" : "Go",
    name,
    openIssues: faker.number.int({ max: 200 }),
    owner,
    ownerAvatarUrl: faker.image.avatar(),
    pushedAt: faker.date.recent({ days: 30 }),
    size: faker.number.int({ max: 200_000, min: 100 }),
    stars: faker.number.int({ max: 25_000 }),
    topics: [primaryTopic, secondaryTopic],
    updatedAt: faker.date.recent({ days: 30 }),
    url: `https://github.com/${owner}/${name}`,
    userId,
    visibility: index % 5 === 0 ? Visibility.PRIVATE : Visibility.PUBLIC,
  });
}

function createStressNotification(index: number, repoIds: number[], userId: number) {
  const keywordPool = ["react", "query", "tanstack", "nextjs", "typescript", "postgres"];
  const keyword = keywordPool[index % keywordPool.length]!;
  const repoId = repoIds.length > 0 ? repoIds[index % repoIds.length]! : undefined;
  const notificationType =
    index % 4 === 0
      ? NotifyType.WARNING
      : index % 4 === 1
        ? NotifyType.INFO
        : index % 4 === 2
          ? NotifyType.SUCCESS
          : NotifyType.ERROR;

  return clean({
    ...Fake.fakeNotification(),
    body: `Benchmark notification ${index} mentions ${keyword} and exercises substring search paths`,
    createdAt: faker.date.recent({ days: 30 }),
    isRead: index % 3 === 0,
    repoId,
    title: `${keyword} search benchmark ${index}`,
    type: notificationType,
    userId,
  });
}

async function seedStressProfile() {
  const existingUser = await prisma.user.findUnique({
    select: { id: true },
    where: { email: STRESS_USER_EMAIL },
  });

  if (existingUser != null) {
    await prisma.notification.deleteMany({ where: { userId: existingUser.id } });
    await prisma.repo.deleteMany({ where: { userId: existingUser.id } });
  }

  if (STRESS_REPO_COUNT === 0 && STRESS_NOTIFICATION_COUNT === 0) {
    return;
  }

  console.log("Creating dedicated search benchmark profile...");

  const benchmarkUser = await prisma.user.upsert({
    create: clean({
      ...Fake.fakeUser(),
      email: STRESS_USER_EMAIL,
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: STRESS_USER_NAME,
      role: UserRole.USER,
    }),
    update: {
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: STRESS_USER_NAME,
    },
    where: { email: STRESS_USER_EMAIL },
  });

  await prisma.notification.deleteMany({
    where: { userId: benchmarkUser.id },
  });

  await prisma.repo.deleteMany({
    where: { userId: benchmarkUser.id },
  });

  if (STRESS_REPO_COUNT > 0) {
    const totalRepoBatches = Math.ceil(STRESS_REPO_COUNT / REPO_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalRepoBatches; batchIndex++) {
      const start = batchIndex * REPO_BATCH_SIZE;
      const batchLength = Math.min(REPO_BATCH_SIZE, STRESS_REPO_COUNT - start);
      const repoBatch = Array.from({ length: batchLength }, (_, offset) =>
        createStressRepo(start + offset, benchmarkUser.id)
      );

      await prisma.repo.createMany({ data: repoBatch });
      console.log(`  benchmark repos batch ${batchIndex + 1}/${totalRepoBatches}`);
    }
  }

  const benchmarkRepos = await prisma.repo.findMany({
    select: { id: true },
    where: { userId: benchmarkUser.id },
  });
  const repoIds = benchmarkRepos.map((repo) => repo.id);

  if (STRESS_NOTIFICATION_COUNT > 0) {
    const totalNotificationBatches = Math.ceil(STRESS_NOTIFICATION_COUNT / NOTIFICATION_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalNotificationBatches; batchIndex++) {
      const start = batchIndex * NOTIFICATION_BATCH_SIZE;
      const batchLength = Math.min(NOTIFICATION_BATCH_SIZE, STRESS_NOTIFICATION_COUNT - start);
      const notificationBatch = Array.from({ length: batchLength }, (_, offset) =>
        createStressNotification(start + offset, repoIds, benchmarkUser.id)
      );

      await prisma.notification.createMany({ data: notificationBatch });
      console.log(`  benchmark notifications batch ${batchIndex + 1}/${totalNotificationBatches}`);
    }
  }

  console.log(
    `Benchmark profile ready: ${STRESS_REPO_COUNT} repos, ${STRESS_NOTIFICATION_COUNT} notifications`
  );
}

async function main() {
  console.log("Starting seed with auto-generated fake data...");

  const admin = await prisma.user.upsert({
    create: clean({
      ...Fake.fakeUser(),
      email: MY_EMAIL,
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: "Karen Avakov",
      role: UserRole.ADMIN,
    }),
    update: {
      emailVerified: new Date(),
      image: faker.image.avatar(),
      name: "Karen Avakov",
      role: UserRole.ADMIN,
    },
    where: { email: MY_EMAIL },
  });
  console.log(`Admin ready: ${admin.email}`);

  console.log("Creating more users...");
  for (let index = 0; index < LIGHT_USER_COUNT; index++) {
    const user = await prisma.user.create({
      data: clean({
        ...Fake.fakeUser(),
        apiKeys: {
          create: [clean(Fake.fakeApiKey()), clean(Fake.fakeApiKey())],
        },
        email: faker.internet.email(),
        image: faker.image.avatar(),
        name: faker.person.fullName(),
        repos: {
          create: Array.from({ length: LIGHT_REPOS_PER_USER }).map(() =>
            clean({
              ...Fake.fakeRepo(),
              analyses: {
                create: [
                  clean({
                    ...Fake.fakeAnalysis(),
                    progress: 100,
                    score: faker.number.int({ max: 100, min: 1 }),
                    status: Status.DONE,
                  }),
                  clean({
                    ...Fake.fakeAnalysis(),
                    progress: faker.number.int({ max: 99, min: 1 }),
                    status: Status.PENDING,
                  }),
                ],
              },
              description: faker.lorem.sentence(),
              forks: faker.number.int({ max: 5000 }),
              githubId: faker.number.int({ max: 100_000_000 }),
              name: `${faker.word.noun()}-${faker.string.alphanumeric(4)}`,
              openIssues: faker.number.int({ max: 100 }),
              size: faker.number.int({ max: 100_000 }),
              stars: faker.number.int({ max: 10_000 }),
              url: faker.internet.url(),
            })
          ),
        },
      }),
    });

    console.log(`  user created: ${user.name}`);
  }

  console.log("Creating notifications...");
  await prisma.notification.createMany({
    data: Array.from({ length: 10 }).map(() =>
      clean({
        ...Fake.fakeNotification(),
        isRead: faker.datatype.boolean(),
        userId: admin.id,
      })
    ),
  });

  await seedStressProfile();

  console.log("Writing audit logs...");
  await prisma.auditLog.createMany({
    data: Array.from({ length: 20 }).map(() =>
      clean({
        ...Fake.fakeAuditLog(),
        ip: faker.internet.ip(),
        model: "Repo",
        operation: "CREATE",
        userId: admin.id,
      })
    ),
  });

  console.log("Seeding completed. Database is now full of life.");
}

try {
  await main();
  await prisma.$disconnect();
  await pool.end();
} catch (error) {
  console.error("Seeding failed:", error);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
}
