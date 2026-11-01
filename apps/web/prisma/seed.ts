// run: bun db:seed

import { NotifyType, Status, UserRole, Visibility } from "@doxynix/shared";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import { Pool } from "pg";

import { fieldEncryptionExtension } from "@/server/core/field-encryption";
import { parseRepoMetrics } from "@/server/modules/analysis/engine/core/metrics.schemas";
import { getNormalizedHash } from "@/server/utils/hash";

import * as Fake from "./generated/fake-data";

const DATABASE_URL = process.env.DATABASE_URL;
const LIGHT_USER_COUNT = 50;
const LIGHT_REPOS_PER_USER = 3;
const REPO_BATCH_SIZE = 500;
const NOTIFICATION_BATCH_SIZE = 500;
const MY_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.test";
const STRESS_USER_EMAIL = "search-benchmark@example.test";
const STRESS_USER_NAME = "Search Benchmark";

const seededAvatar = () => faker.image.avatarGitHub();

const STRESS_REPO_COUNT = parseSeedNumber(process.env.SEED_STRESS_REPOS, 0);
const STRESS_NOTIFICATION_COUNT = parseSeedNumber(process.env.SEED_STRESS_NOTIFICATIONS, 0);

const pool = new Pool({ connectionString: DATABASE_URL });

const decryptionKeys = (process.env.PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS ?? "")
  .split(",")
  .filter(Boolean);

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["error", "warn"],
}).$extends(
  fieldEncryptionExtension({
    decryptionKeys,
    encryptionKey: process.env.PRISMA_FIELD_ENCRYPTION_KEY ?? "",
  }),
);

function clean<T>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, value]) => value !== undefined),
  ) as T;
}

function parseSeedNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid seed count: "${value}". Expected a positive integer.`);
  }

  return Number(trimmed);
}

async function ensureSeedWorkspace(userId: string, name: string): Promise<string> {
  const existing = await prisma.workspaceMember.findFirst({
    select: { workspaceId: true },
    where: { userId },
  });

  if (existing != null) {
    return existing.workspaceId;
  }

  const workspace = await prisma.workspace.create({
    data: {
      entitlement: { create: {} },
      members: { create: { role: "OWNER", userId } },
      name: `${name} workspace`,
    },
    select: { id: true },
  });

  return workspace.id;
}

async function createEmptySeedWorkspace(name: string): Promise<string> {
  const workspace = await prisma.workspace.create({
    data: { entitlement: { create: {} }, name: `${name} workspace` },
    select: { id: true },
  });

  return workspace.id;
}

function createStressRepo(
  index: number,
  userId: string,
  workspaceId: string,
): Prisma.RepoCreateManyInput {
  const ownerPool = [
    "vercel",
    "facebook",
    "microsoft",
    "tanstack",
    "nestjs",
    "vuejs",
    "angular",
  ] as const;
  const topicPool = [
    "react",
    "typescript",
    "nextjs",
    "nodejs",
    "graphql",
    "postgres",
    "prisma",
  ] as const;

  const owner: string = ownerPool[index % ownerPool.length] ?? "doxynix";
  const primaryTopic = topicPool[index % topicPool.length] ?? "react";
  const secondaryTopic = topicPool[(index + 1) % topicPool.length] ?? "typescript";
  const name = index % 9 === 0 ? `react-query-bench-${index}` : `${primaryTopic}-bench-${index}`;
  const description =
    index % 4 === 0
      ? `Benchmark repository ${index} for react query search and GitHub-style substring matching`
      : `Benchmark repository ${index} for ${owner} with ${primaryTopic} and ${secondaryTopic}`;

  const fake = Fake.fakeRepo();

  return {
    createdAt: faker.date.recent({ days: 90 }),
    createdByUserId: userId,
    defaultBranch: "main",
    description,
    forks: faker.number.int({ max: 5000 }),
    githubCreatedAt: faker.date.past({ years: 3 }),
    githubId: 900_000_000 + index,
    language: index % 3 === 0 ? "TypeScript" : index % 3 === 1 ? "JavaScript" : "Go",
    license: fake.license ?? null,
    name,
    openIssues: faker.number.int({ max: 200 }),
    owner,
    ownerAvatarUrl: seededAvatar(),
    pushedAt: faker.date.recent({ days: 30 }),
    size: faker.number.int({ max: 200_000, min: 100 }),
    stars: faker.number.int({ max: 25_000 }),
    topics: [primaryTopic, secondaryTopic],
    updatedAt: faker.date.recent({ days: 30 }),
    url: `https://github.com/${owner}/${name}`,
    visibility: index % 5 === 0 ? Visibility.PRIVATE : Visibility.PUBLIC,
    workspaceId,
  };
}

function createStressNotification(index: number, repoIds: string[], userId: string) {
  const keywordPool = ["react", "query", "tanstack", "nextjs", "typescript", "postgres"];
  const keyword = keywordPool[index % keywordPool.length];
  const repoId = repoIds.length > 0 ? repoIds[index % repoIds.length] : undefined;
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

const TECH_POOL = [
  "Docker",
  "Kubernetes",
  "Redis",
  "Kafka",
  "PostgreSQL",
  "React",
  "Next.js",
  "Tailwind",
  "gRPC",
  "GraphQL",
  "Go Fiber",
  "Prisma",
];

function assertMetricsParseable(metrics: Record<string, unknown>): void {
  const parsed = parseRepoMetrics(metrics);
  if (parsed == null) {
    throw new Error(
      "generateMetricsJson produced metrics the analysis schema rejects; " +
        "the seed would silently produce unreadable analyses",
    );
  }
}

function generateMetricsJson(repoName: string, isBad: boolean) {
  const slug = repoName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const techStack = faker.helpers.arrayElements(TECH_POOL, { max: 4, min: 2 });
  const fileCount = faker.number.int({ max: 400, min: 40 });
  const hot = (n: number) => (isBad ? n : Math.max(2, Math.round(n / 5)));

  const paths = [
    `src/${slug}/service.ts`,
    `src/${slug}/controller.ts`,
    `src/${slug}/repository.ts`,
    `src/${slug}/schema.ts`,
    `src/${slug}/config.ts`,
  ];

  const securityFindings = isBad
    ? [
        {
          line: 12,
          message: "Hardcoded credentials found",
          path: paths[0] ?? "src/app.ts",
          severity: "error" as const,
        },
        {
          line: 40,
          message: "Insecure TLS configuration",
          path: paths[1] ?? "src/app.ts",
          severity: "warning" as const,
        },
      ]
    : [];

  const entrypoints = [`src/${slug}/index.ts`, `src/${slug}/cli.ts`];

  return {
    analysisCoverage: {
      heuristicFiles: fileCount,
      languagesByMode: {
        heuristic: paths,
        treeSitter: paths,
        typeScriptAst: paths,
      },
      parserCoveragePercent: isBad ? 62 : 98,
      totalFiles: fileCount,
      treeSitterFiles: fileCount,
      typeScriptAstFiles: fileCount,
    },
    apiSurface: isBad ? 40 : 12,
    busFactor: isBad ? 1 : faker.number.int({ max: 5, min: 2 }),
    changeCoupling: [
      {
        commits: faker.number.int({ max: 20, min: 5 }),
        fromPath: paths[2] ?? "a",
        toPath: paths[0] ?? "b",
      },
      {
        commits: faker.number.int({ max: 15, min: 3 }),
        fromPath: "api/routes.ts",
        toPath: "docs/openapi.yaml",
      },
    ],
    churnHotspots: paths.slice(0, 3).map((path) => ({
      changeCount: hot(30),
      churnScore: hot(90),
      path,
    })),
    complexityScore: hot(85),
    configFiles: isBad ? 12 : 3,
    configInventory: ["config/settings.yaml", "config/database.yml", "docker-compose.yml"],
    dependencyCycles: isBad ? [["src/a.ts", "src/b.ts", "src/a.ts"]] : [],
    dependencyHotspots: paths.slice(0, 3).map((path) => ({
      dependencies: hot(14),
      dependents: hot(9),
      path,
      score: hot(88),
    })),
    docDensity: isBad ? 0.04 : 0.31,
    documentationInput: {
      readme: `# ${repoName}`,
      structure: paths,
    },
    duplicationReport: {
      clones: isBad
        ? [
            {
              fragmentPreview: "export function handler() { /* … */ }",
              lines: 40,
              primary: { endLine: 140, path: paths[0] ?? "src/a.ts", startLine: 100 },
              secondary: { endLine: 220, path: paths[1] ?? "src/b.ts", startLine: 180 },
            },
          ]
        : [],
      duplicationPercentage: isBad ? 14 : 2,
      totalDuplicatedLines: isBad ? 240 : 18,
    },
    entrypointDetails: entrypoints.map((path) => ({ kind: "module", path, symbol: "main" })),
    entrypoints,
    factCount: isBad ? 12 : 74,
    fileCategoryBreakdown: [
      { category: "src", count: Math.round(fileCount * 0.7) },
      { category: "test", count: Math.round(fileCount * 0.2) },
      { category: "config", count: Math.round(fileCount * 0.1) },
    ],
    fileCount,
    findingCount: securityFindings.length + (isBad ? 18 : 3),
    frameworkFacts: [{ confidence: 0.9, framework: "Next.js", version: "16.3.8" }],
    hotspotFiles: paths.slice(0, 3),
    hotspotSignals: paths.slice(0, 3).map((path, i) => ({
      complexity: hot([40, 30, 10][i] ?? 20),
      path,
      score: hot([85, 70, 95][i] ?? 40),
    })),
    languages: [
      { color: "#3178c6", lines: faker.number.int({ max: 12_000, min: 2000 }), name: "TypeScript" },
      { color: "#00ADD8", lines: faker.number.int({ max: 5000, min: 500 }), name: "Go" },
      { color: "#e34c26", lines: faker.number.int({ max: 3000, min: 300 }), name: "CSS" },
    ],
    maintenanceStatus: isBad ? "stale" : "active",
    modularityIndex: isBad ? 0.31 : 0.82,
    mostComplexFiles: paths.slice(0, 2),
    onboardingScore: isBad ? 24 : 86,
    openapiInventory: {
      operations: isBad ? 4 : 18,
      specPath: "docs/openapi.yaml",
      version: "3.1.0",
    },
    orphanModules: isBad ? ["src/legacy/old.ts"] : [],
    publicExports: isBad ? 8 : 64,
    routeInventory: {
      estimatedOperations: isBad ? 6 : 22,
      frameworks: ["Next.js"],
      httpRoutes: [
        { method: "GET", path: "/api/items", sourcePath: paths[1] ?? "src/a.ts" },
        { method: "POST", path: "/api/items", sourcePath: paths[1] ?? "src/a.ts" },
      ],
    },
    securityFindings,
    securityScanStatus: isBad ? "partial" : "ok",
    securityScore: isBad ? 28 : 94,
    teamRoles: [
      { login: "karen", role: "maintainer", share: 0.6 },
      { login: "alex", role: "reviewer", share: 0.4 },
    ],
    techDebtScore: isBad ? 78 : 19,
    techStack,
    totalLoc: faker.number.int({ max: 50_000, min: 5000 }),
    totalSizeKb: faker.number.int({ max: 8000, min: 400 }),
  };
}

async function seedStressProfile() {
  const existingUser = await prisma.user.findUnique({
    select: { id: true },
    where: { emailHash: getNormalizedHash(STRESS_USER_EMAIL) },
  });

  if (existingUser != null) {
    const existingWorkspace = await prisma.workspaceMember.findFirst({
      select: { workspaceId: true },
      where: { userId: existingUser.id },
    });

    await prisma.notification.deleteMany({ where: { userId: existingUser.id } });

    if (existingWorkspace != null) {
      await prisma.repo.deleteMany({ where: { workspaceId: existingWorkspace.workspaceId } });
    }
  }

  if (STRESS_REPO_COUNT === 0 && STRESS_NOTIFICATION_COUNT === 0) {
    return;
  }

  console.log("Creating dedicated search benchmark profile...");

  const benchmarkUser = await prisma.user.upsert({
    create: clean({
      ...Fake.fakeUser(),
      email: STRESS_USER_EMAIL,
      emailVerified: true,
      image: seededAvatar(),
      name: STRESS_USER_NAME,
      role: UserRole.USER,
    }),
    update: {
      emailVerified: true,
      image: seededAvatar(),
      name: STRESS_USER_NAME,
    },
    where: { emailHash: getNormalizedHash(STRESS_USER_EMAIL) },
  });

  const benchmarkWorkspaceId = await ensureSeedWorkspace(
    benchmarkUser.id,
    benchmarkUser.name ?? STRESS_USER_NAME,
  );

  await prisma.notification.deleteMany({ where: { userId: benchmarkUser.id } });
  await prisma.repo.deleteMany({ where: { workspaceId: benchmarkWorkspaceId } });

  if (STRESS_REPO_COUNT > 0) {
    const totalRepoBatches = Math.ceil(STRESS_REPO_COUNT / REPO_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalRepoBatches; batchIndex++) {
      const start = batchIndex * REPO_BATCH_SIZE;
      const batchLength = Math.min(REPO_BATCH_SIZE, STRESS_REPO_COUNT - start);
      const repoBatch = Array.from({ length: batchLength }, (_, offset) =>
        createStressRepo(start + offset, benchmarkUser.id, benchmarkWorkspaceId),
      );

      await prisma.repo.createMany({ data: repoBatch });
      console.log(`  benchmark repos batch ${batchIndex + 1}/${totalRepoBatches}`);
    }
  }

  const benchmarkRepos = await prisma.repo.findMany({
    select: { id: true },
    where: { workspaceId: benchmarkWorkspaceId },
  });
  const repoIds = benchmarkRepos.map((repo) => repo.id);

  if (STRESS_NOTIFICATION_COUNT > 0) {
    const totalNotificationBatches = Math.ceil(STRESS_NOTIFICATION_COUNT / NOTIFICATION_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalNotificationBatches; batchIndex++) {
      const start = batchIndex * NOTIFICATION_BATCH_SIZE;
      const batchLength = Math.min(NOTIFICATION_BATCH_SIZE, STRESS_NOTIFICATION_COUNT - start);
      const notificationBatch = Array.from({ length: batchLength }, (_, offset) =>
        createStressNotification(start + offset, repoIds, benchmarkUser.id),
      );

      await prisma.notification.createMany({ data: notificationBatch });
      console.log(`  benchmark notifications batch ${batchIndex + 1}/${totalNotificationBatches}`);
    }
  }

  console.log(
    `Benchmark profile ready: ${STRESS_REPO_COUNT} repos, ${STRESS_NOTIFICATION_COUNT} notifications`,
  );
}

async function main() {
  console.log("Starting seed with auto-generated fake data...");

  // Fail loudly here rather than let every analysis degrade to EMPTY_REPO_METRICS at read time.
  assertMetricsParseable(generateMetricsJson("selftest-bad", true));
  assertMetricsParseable(generateMetricsJson("selftest-good", false));

  const admin = await prisma.user.upsert({
    create: clean({
      ...Fake.fakeUser(),
      email: MY_EMAIL,
      emailVerified: true,
      image: seededAvatar(),
      name: "Alice",
      role: UserRole.ADMIN,
    }),
    update: {
      emailVerified: true,
      image: seededAvatar(),
      name: "Alice",
      role: UserRole.ADMIN,
    },
    where: { emailHash: getNormalizedHash(MY_EMAIL) },
  });
  console.log(`Admin ready: ${admin.email}`);

  const adminReposData = Array.from({ length: 5 }).map(() => {
    const repoName = `admin-project-${faker.string.alphanumeric(4)}`;

    return clean({
      ...Fake.fakeRepo(),
      analyses: {
        create: [
          clean({
            ...Fake.fakeAnalysis(),
            complexityScore: faker.number.int({ max: 40, min: 20 }),
            createdAt: subDays(new Date(), 40),
            metricsJson: generateMetricsJson(repoName, true),
            onboardingScore: faker.number.int({ max: 90, min: 75 }),
            score: 45,
            securityScore: faker.number.int({ max: 50, min: 30 }),
            status: Status.DONE,
            techDebtScore: faker.number.int({ max: 30, min: 10 }),
          }),
          clean({
            ...Fake.fakeAnalysis(),
            complexityScore: faker.number.int({ max: 40, min: 20 }),
            createdAt: new Date(),
            metricsJson: generateMetricsJson(repoName, false),
            onboardingScore: faker.number.int({ max: 90, min: 75 }),
            score: 85,
            securityScore: faker.number.int({ max: 100, min: 70 }),
            status: Status.DONE,
            techDebtScore: faker.number.int({ max: 30, min: 10 }),
          }),
        ],
      },
      description: "Admin seed repository for dashboard testing",
      githubId: faker.number.int({ max: 2_000_000_000, min: 100_000_000 }),
      name: repoName,
    });
  });

  const adminWorkspaceId = await ensureSeedWorkspace(admin.id, admin.name ?? "Admin");

  for (const repo of adminReposData) {
    await prisma.repo.create({
      data: { ...repo, createdByUserId: admin.id, workspaceId: adminWorkspaceId },
    });
  }

  console.log("Creating more users...");

  for (let index = 0; index < LIGHT_USER_COUNT; index++) {
    const lightWorkspaceId = await createEmptySeedWorkspace(faker.person.fullName());
    const user = await prisma.user.create({
      data: clean({
        ...Fake.fakeUser(),
        apiKeys: {
          create: [clean(Fake.fakeApiKey()), clean(Fake.fakeApiKey())].map((key) => ({
            ...key,
            workspaceId: lightWorkspaceId,
          })),
        },
        createdRepos: {
          create: Array.from({ length: LIGHT_REPOS_PER_USER }).map(() => {
            const repoName = `${faker.word.noun()}-${faker.string.alphanumeric(4)}`;

            return clean({
              ...Fake.fakeRepo(),
              analyses: {
                create: [
                  clean({
                    ...Fake.fakeAnalysis(),
                    complexityScore: faker.number.int({ max: 90, min: 70 }),
                    createdAt: faker.date.between({
                      from: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
                      to: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
                    }),
                    metricsJson: generateMetricsJson(repoName, true),
                    onboardingScore: faker.number.int({ max: 40, min: 20 }),
                    progress: 100,
                    score: faker.number.int({ max: 55, min: 40 }),
                    securityScore: faker.number.int({ max: 50, min: 30 }),
                    status: Status.DONE,
                    techDebtScore: faker.number.int({ max: 80, min: 60 }),
                  }),
                  clean({
                    ...Fake.fakeAnalysis(),
                    complexityScore: faker.number.int({ max: 40, min: 20 }),
                    createdAt: faker.date.recent({ days: 10 }),
                    metricsJson: generateMetricsJson(repoName, false),
                    onboardingScore: faker.number.int({ max: 90, min: 70 }),
                    progress: 100,
                    score: faker.number.int({ max: 95, min: 75 }),
                    securityScore: faker.number.int({ max: 100, min: 80 }),
                    status: Status.DONE,
                    techDebtScore: faker.number.int({ max: 30, min: 10 }),
                  }),
                  clean({
                    ...Fake.fakeAnalysis(),
                    createdAt: new Date(),
                    progress: faker.number.int({ max: 99, min: 1 }),
                    status: Status.PENDING,
                  }),
                ],
              },
              description: faker.lorem.sentence(),
              documents: {
                create: [
                  { content: "# Mock", type: "README", version: "1.0" },
                  { content: "## API", type: "API", version: "1.0" },
                ],
              },
              forks: faker.number.int({ max: 5000 }),
              githubId: faker.number.int({ max: 100_000_000 }),
              name: repoName,
              openIssues: faker.number.int({ max: 100 }),
              size: faker.number.int({ max: 100_000 }),
              stars: faker.number.int({ max: 10_000 }),
              url: faker.internet.url(),
              workspaceId: lightWorkspaceId,
            });
          }),
        },
        email: faker.internet.email(),
        image: seededAvatar(),
        name: faker.person.fullName(),
        workspaceMemberships: { create: { role: "OWNER", workspaceId: lightWorkspaceId } },
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
      }),
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
      }),
    ),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seeding completed. Database is now full of life.");
  })
  .catch(async (error) => {
    console.error("Seeding failed:", error);
    await prisma.$disconnect();
    throw new Error("Seeding failed");
  });
