import crypto from "node:crypto";

import { NextRequest } from "next/server";
import { enhance } from "@zenstackhq/runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { redisClient } from "@/server/core/redis";
import { createCallerFactory } from "@/server/core/trpc/init";
import { createPersonalWorkspace } from "@/server/core/workspaces/personal-workspace";
import { appRouter } from "@/server/modules";
import { buildRequestStore } from "@/server/utils/request-context";

import { cleanupDatabase, createAnon, createBareTestUser, createTestUser } from "../helpers";

type TestUser = Awaited<ReturnType<typeof createTestUser>>["user"];

function callerFor(user: TestUser, workspaceId?: string) {
  const headers = new Headers({ "x-trpc-source": "test" });

  if (workspaceId != null) {
    headers.set("x-workspace-id", workspaceId);
  }

  const req = new NextRequest("http://localhost/api/trpc", { headers });

  return createCallerFactory(appRouter)({
    prisma,
    redis: redisClient,
    req,
    requestInfo: buildRequestStore({
      method: "TEST",
      path: "/test",
      req,
      userId: user.id,
      userRole: user.role,
    }),
    session: {
      session: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        updatedAt: new Date(),
        userId: user.id,
      },
      user: {
        banned: user.banned,
        createdAt: user.createdAt,
        email: user.email ?? "",
        emailVerified: user.emailVerified,
        id: user.id,
        image: user.image,
        name: user.name ?? "User",
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
        updatedAt: user.updatedAt,
      },
    },
  });
}

describe("Workspace service and router", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("creates one personal workspace per user, idempotently", async () => {
    const alice = await createTestUser("Alice");

    const first = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const second = await createPersonalWorkspace(alice.user.id, alice.user.name);

    expect(second).toBe(first);

    const workspace = await prisma.workspace.findUnique({
      include: { entitlement: true, members: true },
      where: { id: first },
    });

    expect(workspace?.members).toHaveLength(1);
    expect(workspace?.members[0]?.role).toBe("OWNER");
    expect(workspace?.entitlement?.planCode).toBe("HOBBY");
    expect(workspace?.entitlement?.seatLimit).toBe(1);
  });

  it("creates the personal workspace from the Better-Auth registration hook", async () => {
    const alice = await createTestUser("Alice");
    const hooks = auth.options as unknown as {
      databaseHooks?: {
        user?: {
          create?: { after?: (user: { id: string; name?: null | string }) => Promise<void> };
        };
      };
    };

    const after = hooks.databaseHooks?.user?.create?.after;

    expect(after).toBeTypeOf("function");
    await after?.({ id: alice.user.id, name: alice.user.name });

    const membership = await prisma.workspaceMember.findFirst({
      include: { workspace: true },
      where: { userId: alice.user.id },
    });

    expect(membership?.role).toBe("OWNER");
    expect(membership?.workspace.name).toBe("Alice workspace");
  });

  it("lazily provisions a personal workspace for a user without one", async () => {
    const alice = await createBareTestUser("Alice");
    const caller = callerFor(alice.user);

    const result = await caller.workspace.myWorkspaces();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.role).toBe("OWNER");
    expect(result.items[0]?.entitlement?.planCode).toBe("HOBBY");
    expect(result.activeWorkspaceId).toBe(result.items[0]?.id);
    expect(result.reset).toBe(false);
  });

  it("falls back to the default workspace when the header membership is gone", async () => {
    const alice = await createTestUser("Alice");
    const personalId = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const second = await prisma.workspace.create({ data: { name: "Second" } });

    await prisma.workspaceMember.create({
      data: { role: "OWNER", userId: alice.user.id, workspaceId: second.id },
    });

    const caller = callerFor(alice.user, second.id);
    const before = await caller.workspace.myWorkspaces();

    expect(before.activeWorkspaceId).toBe(second.id);
    expect(before.reset).toBe(false);

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { userId: alice.user.id, workspaceId: second.id } },
    });

    const after = await caller.workspace.myWorkspaces();

    expect(after.activeWorkspaceId).toBe(personalId);
    expect(after.reset).toBe(true);

    const upgraded = await caller.workspace.upgradeToPro();

    expect(upgraded.id).toBe(personalId);
  });

  it("lazily provisions a workspace from workspaceProcedure when the header is absent", async () => {
    const alice = await createBareTestUser("Alice");
    const caller = callerFor(alice.user);

    const upgraded = await caller.workspace.upgradeToPro();

    expect(upgraded.entitlement?.planCode).toBe("PRO");
    await expect(prisma.workspace.count()).resolves.toBe(1);
  });

  it("answers FORBIDDEN, not NOT_FOUND, for an explicitly requested foreign workspace", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const caller = callerFor(bob.user);

    await expect(caller.workspace.switchWorkspace({ workspaceId })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Workspace access denied",
    });
  });

  it("refuses new members on HOBBY and allows them after an in-place PRO upgrade", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const caller = callerFor(alice.user, workspaceId);

    await expect(caller.workspace.addMember({ email: bob.email })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "UPGRADE_REQUIRED",
    });

    const workspaceCountBefore = await prisma.workspace.count();
    const upgraded = await caller.workspace.upgradeToPro();

    expect(upgraded.id).toBe(workspaceId);
    expect(upgraded.entitlement?.planCode).toBe("PRO");
    await expect(prisma.workspace.count()).resolves.toBe(workspaceCountBefore);

    const member = await caller.workspace.addMember({ email: bob.email });

    expect(member.role).toBe("MEMBER");
    expect(member.userId).toBe(bob.user.id);
  });

  it("returns BILLING_NOT_READY when the local upgrade flag is off", async () => {
    const alice = await createTestUser("Alice");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const caller = callerFor(alice.user, workspaceId);

    process.env.BILLING_LOCAL_UPGRADE_ENABLED = "false";

    try {
      await expect(caller.workspace.upgradeToPro()).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "BILLING_NOT_READY",
      });
    } finally {
      process.env.BILLING_LOCAL_UPGRADE_ENABLED = "true";
    }
  });

  it("refuses to remove the last OWNER", async () => {
    const alice = await createTestUser("Alice");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);
    const caller = callerFor(alice.user, workspaceId);

    await expect(caller.workspace.removeMember({ userId: alice.user.id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "LAST_OWNER",
    });
  });

  it("removes an OWNER when another OWNER remains", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);

    await prisma.workspaceMember.create({
      data: { role: "OWNER", userId: bob.user.id, workspaceId },
    });

    const caller = callerFor(alice.user, workspaceId);

    await caller.workspace.removeMember({ userId: bob.user.id });

    await expect(prisma.workspaceMember.count({ where: { workspaceId } })).resolves.toBe(1);
  });

  it("lets a member read the workspace, its members and its entitlement, and denies everyone else", async () => {
    const alice = await createTestUser("Alice");
    const bob = await createTestUser("Bob");
    const workspaceId = await createPersonalWorkspace(alice.user.id, alice.user.name);

    const aliceDb = enhance(prisma, { user: { id: alice.user.id, role: alice.user.role } });
    const bobDb = enhance(prisma, { user: { id: bob.user.id, role: bob.user.role } });
    const anon = createAnon().db;

    await expect(
      aliceDb.workspace.findUnique({ where: { id: workspaceId } }),
    ).resolves.toBeDefined();
    await expect(
      aliceDb.workspaceMember.findMany({ where: { workspaceId } }),
    ).resolves.toHaveLength(1);
    await expect(
      aliceDb.workspaceEntitlement.findUnique({ where: { workspaceId } }),
    ).resolves.toBeDefined();

    await expect(bobDb.workspace.findUnique({ where: { id: workspaceId } })).resolves.toBeNull();
    await expect(bobDb.workspaceMember.findMany({ where: { workspaceId } })).resolves.toHaveLength(
      0,
    );
    await expect(
      bobDb.workspaceEntitlement.findUnique({ where: { workspaceId } }),
    ).resolves.toBeNull();

    await expect(anon.workspace.findMany()).resolves.toHaveLength(0);
    await expect(anon.workspaceMember.findMany()).resolves.toHaveLength(0);
    await expect(anon.workspaceEntitlement.findMany()).resolves.toHaveLength(0);
  });
});
