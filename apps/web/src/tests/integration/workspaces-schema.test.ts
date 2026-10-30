import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import { cleanupDatabase, createTestUser } from "../helpers";

type ColumnRow = { column_name: string; is_nullable: string; table_name: string };

async function columnsFor(table: string): Promise<Array<ColumnRow>> {
  return prisma.$queryRaw<Array<ColumnRow>>`
    SELECT table_name::text, column_name::text, is_nullable::text
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
}

describe("Workspace tenancy schema", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("creates a workspace with an owner membership and a HOBBY entitlement", async () => {
    const alice = await createTestUser("Alice");
    const workspace = await prisma.workspace.create({
      data: {
        entitlement: { create: {} },
        members: { create: { role: "OWNER", userId: alice.user.id } },
        name: "Alice workspace",
      },
      include: { entitlement: true, members: true },
    });

    expect(workspace.members).toHaveLength(1);
    expect(workspace.members[0]?.role).toBe("OWNER");
    expect(workspace.entitlement?.planCode).toBe("HOBBY");
    expect(workspace.entitlement?.seatLimit).toBe(1);
    expect(workspace.entitlement?.reposLimit).toBeNull();
    expect(workspace.entitlement?.privateReposAllowed).toBe(false);
    expect(workspace.entitlement?.autoResync).toBe(false);
    expect(workspace.entitlement?.prReviews).toBe(false);
    expect(workspace.entitlement?.historyDays).toBeNull();
  });

  it("enforces one membership per workspace and user", async () => {
    const alice = await createTestUser("Alice");
    const workspace = await prisma.workspace.create({ data: { name: "Alice workspace" } });

    await prisma.workspaceMember.create({
      data: { role: "OWNER", userId: alice.user.id, workspaceId: workspace.id },
    });

    await expect(
      prisma.workspaceMember.create({
        data: { role: "MEMBER", userId: alice.user.id, workspaceId: workspace.id },
      }),
    ).rejects.toThrow(/unique/i);
  });

  it("enforces one entitlement per workspace", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Alice workspace" } });

    await prisma.workspaceEntitlement.create({ data: { workspaceId: workspace.id } });

    await expect(
      prisma.workspaceEntitlement.create({ data: { workspaceId: workspace.id } }),
    ).rejects.toThrow(/unique/i);
  });

  it("requires workspace ownership on repos and GitHub installations", async () => {
    const repoColumns = await columnsFor("repos");
    const installationColumns = await columnsFor("github_installations");

    expect(repoColumns.find((column) => column.column_name === "workspace_id")?.is_nullable).toBe(
      "NO",
    );
    expect(
      installationColumns.find((column) => column.column_name === "workspace_id")?.is_nullable,
    ).toBe("NO");
    expect(repoColumns.some((column) => column.column_name === "created_by_user_id")).toBe(true);
    expect(repoColumns.some((column) => column.column_name === "user_id")).toBe(false);
  });

  it("scopes repo uniqueness by workspace", async () => {
    const alice = await createTestUser("Alice");
    const first = await prisma.workspace.create({ data: { name: "First" } });
    const second = await prisma.workspace.create({ data: { name: "Second" } });

    const repoData = {
      createdByUserId: alice.user.id,
      githubId: 42,
      name: "same-name",
      owner: "alice",
      url: "https://github.com/alice/same-name",
    };

    await prisma.repo.create({ data: { ...repoData, workspaceId: first.id } });
    await prisma.repo.create({ data: { ...repoData, workspaceId: second.id } });

    await expect(
      prisma.repo.create({ data: { ...repoData, workspaceId: first.id } }),
    ).rejects.toThrow(/unique/i);
  });

  it("defaults a bare entitlement to NO_SUBSCRIPTION and personal workspaces to ACTIVE", async () => {
    const alice = await createTestUser("Alice");
    const personal = await prisma.workspaceEntitlement.findUnique({
      where: { workspaceId: alice.workspace.id },
    });
    const bare = await prisma.workspace.create({
      data: { entitlement: { create: {} }, name: "Bare workspace" },
    });
    const bareEntitlement = await prisma.workspaceEntitlement.findUnique({
      where: { workspaceId: bare.id },
    });

    expect(personal?.accessState).toBe("ACTIVE");
    expect(bareEntitlement?.accessState).toBe("NO_SUBSCRIPTION");
  });

  it("truncates workspace tables through cleanupDatabase", async () => {
    await prisma.workspace.create({ data: { name: "Disposable" } });

    await cleanupDatabase();

    await expect(prisma.workspace.count()).resolves.toBe(0);
    await expect(prisma.workspaceMember.count()).resolves.toBe(0);
    await expect(prisma.workspaceEntitlement.count()).resolves.toBe(0);
  });
});
