import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { createPersonalWorkspace } from "@/server/core/workspaces/personal-workspace";

import { cleanupDatabase, createAnon, createTestUser } from "../helpers";

async function seedWorkspaceArtifacts(workspaceId: string, userId: string) {
  const repo = await prisma.repo.create({
    data: {
      createdByUserId: userId,
      githubId: 7001,
      name: "isolated-repo",
      owner: "alice",
      url: "https://github.com/alice/isolated-repo",
      workspaceId,
    },
  });

  const analysis = await prisma.analysis.create({
    data: { commitSha: "abc123", repoId: repo.id, status: "DONE" },
  });

  const document = await prisma.document.create({
    data: {
      analysisId: analysis.id,
      content: "secret",
      path: "README.md",
      repoId: repo.id,
      type: "README",
      version: "v1",
    },
  });

  const pullRequest = await prisma.pullRequestAnalysis.create({
    data: {
      baseSha: "base",
      headSha: "head",
      owner: "alice",
      prNumber: 1,
      repoId: repo.id,
      repoName: "isolated-repo",
    },
  });

  const comment = await prisma.pullRequestComment.create({
    data: {
      analysisId: pullRequest.id,
      body: "secret",
      filePath: "src/index.ts",
      findingType: "SECURITY",
      line: 1,
      riskLevel: 1,
    },
  });

  const fix = await prisma.generatedFix.create({
    data: { branch: "fix/isolated", repoId: repo.id, title: "Fix" },
  });

  const config = await prisma.pullRequestAnalysisConfig.create({ data: { repoId: repo.id } });

  const chat = await prisma.chatSession.create({
    data: { repoId: repo.id, userId },
  });

  const message = await prisma.chatMessage.create({
    data: { parts: "[]", role: "user", sessionId: chat.id },
  });

  const notification = await prisma.notification.create({
    data: { body: "secret", repoId: repo.id, title: "Secret", userId },
  });

  const installation = await prisma.githubInstallation.create({
    data: {
      accountLogin: "alice",
      appId: 1,
      id: BigInt(7001),
      repositorySelection: "ALL",
      targetId: BigInt(1),
      targetType: "USER",
      userId,
      workspaceId,
    },
  });

  return {
    analysis,
    chat,
    comment,
    config,
    document,
    fix,
    installation,
    message,
    notification,
    pullRequest,
    repo,
  };
}

describe("Tenancy isolation", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("hides every workspace artifact from a non-member", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const aliceWorkspace = await createPersonalWorkspace(alice.user.id, alice.user.name);
    await createPersonalWorkspace(bob.user.id, bob.user.name);

    const artifacts = await seedWorkspaceArtifacts(aliceWorkspace, alice.user.id);
    const aliceDb = enhance(prisma, { user: { id: alice.user.id, role: alice.user.role } });
    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });
    const anon = createAnon().db;

    await expect(
      aliceDb.repo.findUnique({ where: { id: artifacts.repo.id } }),
    ).resolves.toBeDefined();
    await expect(bobDb.repo.findUnique({ where: { id: artifacts.repo.id } })).resolves.toBeNull();

    await expect(
      aliceDb.analysis.findUnique({ where: { id: artifacts.analysis.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.analysis.findUnique({ where: { id: artifacts.analysis.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.document.findUnique({ where: { id: artifacts.document.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.document.findUnique({ where: { id: artifacts.document.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.pullRequestAnalysis.findUnique({ where: { id: artifacts.pullRequest.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.pullRequestAnalysis.findUnique({ where: { id: artifacts.pullRequest.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.pullRequestComment.findUnique({ where: { id: artifacts.comment.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.pullRequestComment.findUnique({ where: { id: artifacts.comment.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.generatedFix.findUnique({ where: { id: artifacts.fix.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.generatedFix.findUnique({ where: { id: artifacts.fix.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.pullRequestAnalysisConfig.findUnique({ where: { id: artifacts.config.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.pullRequestAnalysisConfig.findUnique({ where: { id: artifacts.config.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.chatSession.findUnique({ where: { id: artifacts.chat.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.chatSession.findUnique({ where: { id: artifacts.chat.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.chatMessage.findUnique({ where: { id: artifacts.message.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.chatMessage.findUnique({ where: { id: artifacts.message.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.notification.findUnique({ where: { id: artifacts.notification.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.notification.findUnique({ where: { id: artifacts.notification.id } }),
    ).resolves.toBeNull();

    await expect(
      aliceDb.githubInstallation.findUnique({ where: { id: artifacts.installation.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.githubInstallation.findUnique({ where: { id: artifacts.installation.id } }),
    ).resolves.toBeNull();

    await expect(anon.repo.findMany()).resolves.toHaveLength(0);
    await expect(anon.analysis.findMany()).resolves.toHaveLength(0);
    await expect(anon.document.findMany()).resolves.toHaveLength(0);
    await expect(anon.chatSession.findMany()).resolves.toHaveLength(0);
    await expect(anon.githubInstallation.findMany()).resolves.toHaveLength(0);
  });

  it("allows admin reads across workspaces", async () => {
    const alice = await createTestUser("Alice");
    const admin = await createTestUser("Admin", "ADMIN");
    const aliceWorkspace = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const artifacts = await seedWorkspaceArtifacts(aliceWorkspace, alice.user.id);
    const adminDb = enhance(prisma, { user: { id: admin.user.id, role: admin.user.role } });

    await expect(
      adminDb.repo.findUnique({ where: { id: artifacts.repo.id } }),
    ).resolves.toBeDefined();
    await expect(
      adminDb.analysis.findUnique({ where: { id: artifacts.analysis.id } }),
    ).resolves.toBeDefined();
    await expect(
      adminDb.githubInstallation.findUnique({ where: { id: artifacts.installation.id } }),
    ).resolves.toBeDefined();
  });

  it("denies creating or moving a repo into a workspace the user does not belong to", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const aliceWorkspace = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const bobWorkspace = await createPersonalWorkspace(bob.user.id, bob.user.name);
    const artifacts = await seedWorkspaceArtifacts(aliceWorkspace, alice.user.id);
    const aliceDb = enhance(prisma, { user: { id: alice.user.id, role: alice.user.role } });
    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });

    await expect(
      bobDb.repo.create({
        data: {
          createdByUserId: bob.user.id,
          githubId: 7002,
          name: "stolen",
          owner: "bob",
          url: "https://github.com/bob/stolen",
          workspaceId: aliceWorkspace,
        },
      }),
    ).rejects.toThrow(/denied|policy/i);

    await expect(
      aliceDb.repo.update({
        data: { workspaceId: bobWorkspace },
        where: { id: artifacts.repo.id },
      }),
    ).rejects.toThrow(/denied|policy/i);
  });

  it("lets co-members read each other, but not users from another workspace", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const carol = await createTestUser("Carol");
    const aliceWorkspace = await createPersonalWorkspace(alice.user.id, alice.user.name);
    await createPersonalWorkspace(bob.user.id, bob.user.name);

    await prisma.workspaceMember.create({
      data: { role: "MEMBER", userId: carol.user.id, workspaceId: aliceWorkspace },
    });

    const aliceDb = enhance(prisma, { user: { id: alice.user.id, role: alice.user.role } });
    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });

    await expect(aliceDb.user.findUnique({ where: { id: carol.user.id } })).resolves.toBeDefined();
    await expect(bobDb.user.findUnique({ where: { id: carol.user.id } })).resolves.toBeNull();
    await expect(
      aliceDb.workspaceMember.findFirst({ where: { userId: carol.user.id } }),
    ).resolves.toBeDefined();
    await expect(
      bobDb.workspaceMember.findFirst({ where: { userId: carol.user.id } }),
    ).resolves.toBeNull();
  });
});
