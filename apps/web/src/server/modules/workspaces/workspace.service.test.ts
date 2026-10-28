import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";

import { workspaceService } from "./workspace.service";

vi.mock("@/server/core/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";

function entitlement(overrides: Record<string, unknown> = {}) {
  return {
    aiTokensPerMonth: 1_000_000,
    analysesPerMonth: 20,
    autoResync: false,
    createdAt: new Date("2026-01-01"),
    historyDays: 7,
    id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5f",
    planCode: "HOBBY",
    privateReposAllowed: false,
    prReviews: false,
    reposLimit: null,
    seatLimit: 1,
    updatedAt: new Date("2026-01-01"),
    workspaceId: WORKSPACE_ID,
    ...overrides,
  };
}

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date("2026-01-01"),
    entitlement: entitlement(),
    id: WORKSPACE_ID,
    name: "Alice workspace",
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("workspaceService.addMember", () => {
  it("refuses a HOBBY workspace with the upgrade code the UI can route on", async () => {
    const db = {
      workspace: { findUnique: vi.fn().mockResolvedValue(workspace()) },
    } as never;

    await expect(
      workspaceService.addMember(db, WORKSPACE_ID, "OWNER", "bob@test.com"),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "UPGRADE_REQUIRED" });
  });

  it("adds an existing user to a PRO workspace as a member", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, name: "Bob" } as never);
    const create = vi.fn().mockResolvedValue({
      id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60",
      role: "MEMBER",
      user: { id: USER_ID, name: "Bob" },
      userId: USER_ID,
    });
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: USER_ID }) },
      workspace: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            workspace({ entitlement: entitlement({ planCode: "PRO", seatLimit: 2 }) }),
          ),
      },
      workspaceMember: {
        count: vi.fn().mockResolvedValue(1),
        create,
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never;

    const member = await workspaceService.addMember(db, WORKSPACE_ID, "OWNER", "bob@test.com");

    expect(member.role).toBe("MEMBER");
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { role: "MEMBER", userId: USER_ID, workspaceId: WORKSPACE_ID },
    });
  });

  it("stops at the seat limit instead of silently overfilling the workspace", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, name: "Bob" } as never);
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: USER_ID }) },
      workspace: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            workspace({ entitlement: entitlement({ planCode: "PRO", seatLimit: 1 }) }),
          ),
      },
      workspaceMember: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never;

    await expect(
      workspaceService.addMember(db, WORKSPACE_ID, "OWNER", "bob@test.com"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "LIMIT_EXCEEDED" });
  });
});

describe("workspaceService.upgradeToPro", () => {
  it("rejects a member who is not the owner", async () => {
    const db = {} as never;

    await expect(workspaceService.upgradeToPro(db, WORKSPACE_ID, "MEMBER")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Owner rights required",
    });
  });

  it("updates the same workspace instead of creating a second one", async () => {
    const update = vi.fn().mockResolvedValue(
      entitlement({
        aiTokensPerMonth: 20_000_000,
        analysesPerMonth: 500,
        autoResync: true,
        historyDays: 90,
        planCode: "PRO",
        privateReposAllowed: true,
        prReviews: true,
        seatLimit: 2,
      }),
    );
    const db = {
      workspace: {
        findUnique: vi.fn().mockResolvedValue(
          workspace({
            members: [{ userId: USER_ID }],
          }),
        ),
      },
      workspaceEntitlement: { update },
    } as never;

    const result = await workspaceService.upgradeToPro(db, WORKSPACE_ID, "OWNER");

    expect(result.entitlement?.planCode).toBe("PRO");
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      data: { planCode: "PRO", seatLimit: 2 },
      where: { workspaceId: WORKSPACE_ID },
    });
  });
});

describe("workspaceService.removeMember", () => {
  it("refuses to delete the last OWNER", async () => {
    const remove = vi.fn();
    const tx = {
      workspaceMember: {
        delete: remove,
        findMany: vi.fn().mockResolvedValue([{ role: "OWNER", userId: USER_ID }]),
      },
    };
    const db = {
      $transaction: vi.fn(async (body: (client: unknown) => unknown) => body(tx)),
    } as never;

    await expect(
      workspaceService.removeMember(db, WORKSPACE_ID, "OWNER", USER_ID),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "LAST_OWNER" });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes an owner when another owner remains", async () => {
    const remove = vi.fn().mockResolvedValue({});
    const tx = {
      workspaceMember: {
        delete: remove,
        findMany: vi.fn().mockResolvedValue([
          { role: "OWNER", userId: USER_ID },
          { role: "OWNER", userId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61" },
        ]),
      },
    };
    const db = {
      $transaction: vi.fn(async (body: (client: unknown) => unknown) => body(tx)),
    } as never;

    await workspaceService.removeMember(db, WORKSPACE_ID, "OWNER", USER_ID);

    expect(remove).toHaveBeenCalledWith({
      where: { workspaceId_userId: { userId: USER_ID, workspaceId: WORKSPACE_ID } },
    });
  });
});

describe("workspaceService.switchWorkspace", () => {
  it("answers FORBIDDEN for a workspace the user does not belong to", async () => {
    const db = { workspaceMember: { findUnique: vi.fn().mockResolvedValue(null) } } as never;

    await expect(workspaceService.switchWorkspace(db, WORKSPACE_ID, USER_ID)).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "Workspace access denied" },
    );
  });
});
