import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/core/db";

import { workspaceService } from "./workspace.service";

vi.mock("@/server/core/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const seatSyncMock = vi.hoisted(() => vi.fn());
const issueMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/billing/seat-sync", () => ({ syncWorkspaceSeats: seatSyncMock }));
vi.mock("@/server/core/billing/issue", () => ({ upsertBillingIssue: issueMock }));
vi.mock("@/server/core/app-logger", () => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const MEMBER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60";

// Emulates the Prisma transaction client over the same mocks: addMember takes an advisory lock
// and mutates inside $transaction, so the fake client must expose both methods.
function withTransaction<T extends object>(db: T): never {
  const client = {
    ...db,
    $executeRaw: vi.fn().mockResolvedValue(0),
  };

  return {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
  } as never;
}

function entitlement(overrides: Record<string, unknown> = {}) {
  return {
    accessState: "ACTIVE",
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
      workspaceService.addMember(db, WORKSPACE_ID, "bob@test.com"),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "UPGRADE_REQUIRED" });
  });

  it("adds an existing user to a PRO workspace as a member", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      image: null,
      name: "Bob",
    } as never);
    const create = vi.fn().mockResolvedValue({
      id: MEMBER_ID,
      role: "MEMBER",
      user: { id: USER_ID, name: "Bob" },
      userId: USER_ID,
    });
    const db = withTransaction({
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
    });

    const member = await workspaceService.addMember(db, WORKSPACE_ID, "bob@test.com");

    expect(member.role).toBe("MEMBER");
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { role: "MEMBER", userId: USER_ID, workspaceId: WORKSPACE_ID },
    });
    expect(seatSyncMock).toHaveBeenCalledWith({
      requestId: MEMBER_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it("keeps the committed membership and records an issue when Stripe rejects the seat sync", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      image: null,
      name: "Bob",
    } as never);
    seatSyncMock.mockRejectedValueOnce(new Error("stripe unavailable"));
    const db = withTransaction({
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
        create: vi.fn().mockResolvedValue({ id: MEMBER_ID, role: "MEMBER", userId: USER_ID }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const member = await workspaceService.addMember(db, WORKSPACE_ID, "bob@test.com");

    expect(member.role).toBe("MEMBER");
    expect(issueMock).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        dedupeKey: `seat_sync_failed:${WORKSPACE_ID}`,
        details: { error: "stripe unavailable", requestId: MEMBER_ID },
        kind: "SEAT_SYNC_FAILED",
        severity: "WARNING",
        source: "workspace",
        workspaceId: WORKSPACE_ID,
      }),
    );
  });

  it("adds past the current seat limit and bills the extra seat", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      image: null,
      name: "Bob",
    } as never);
    const create = vi.fn().mockResolvedValue({
      id: MEMBER_ID,
      role: "MEMBER",
      userId: USER_ID,
    });
    const db = withTransaction({
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
        create,
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    const member = await workspaceService.addMember(db, WORKSPACE_ID, "bob@test.com");

    expect(member.role).toBe("MEMBER");
    expect(seatSyncMock).toHaveBeenCalledWith({
      requestId: MEMBER_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it("refuses to add a seat while the subscription is not ACTIVE", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_ID,
      image: null,
      name: "Bob",
    } as never);
    const db = withTransaction({
      user: { findUnique: vi.fn().mockResolvedValue({ id: USER_ID }) },
      workspace: {
        findUnique: vi.fn().mockResolvedValue(
          workspace({
            entitlement: entitlement({
              accessState: "REVIEW",
              planCode: "PRO",
              seatLimit: 3,
            }),
          }),
        ),
      },
      workspaceMember: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      workspaceService.addMember(db, WORKSPACE_ID, "bob@test.com"),
    ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
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

    await expect(workspaceService.removeMember(db, WORKSPACE_ID, USER_ID)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "LAST_OWNER",
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes an owner when another owner remains", async () => {
    const remove = vi.fn().mockResolvedValue({ id: "member_removed" });
    const tx = {
      workspaceMember: {
        delete: remove,
        findMany: vi.fn().mockResolvedValue([
          { id: "member_removed", role: "OWNER", userId: USER_ID },
          {
            id: "member_other_owner",
            role: "OWNER",
            userId: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61",
          },
        ]),
      },
    };
    const db = {
      $transaction: vi.fn(async (body: (client: unknown) => unknown) => body(tx)),
    } as never;

    await workspaceService.removeMember(db, WORKSPACE_ID, USER_ID);

    expect(remove).toHaveBeenCalledWith({
      select: { id: true },
      where: { workspaceId_userId: { userId: USER_ID, workspaceId: WORKSPACE_ID } },
    });
    expect(seatSyncMock).toHaveBeenCalledWith({
      requestId: "remove:member_removed",
      workspaceId: WORKSPACE_ID,
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
