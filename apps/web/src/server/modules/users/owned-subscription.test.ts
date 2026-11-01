import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertNotSubscriptionOwner,
  listMemberWorkspaceIds,
  syncSeatsAfterUserDeletion,
} from "./owned-subscription";

const dbMock = vi.hoisted(() => ({
  workspaceMember: { findFirst: vi.fn(), findMany: vi.fn() },
}));
const seatSyncMock = vi.hoisted(() => vi.fn());
const logMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/server/core/db", () => ({ prisma: dbMock }));
vi.mock("@/server/core/billing/seat-sync", () => ({ syncWorkspaceSeats: seatSyncMock }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: logMock }));

describe("assertNotSubscriptionOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to delete a user who owns a workspace with a live subscription", async () => {
    dbMock.workspaceMember.findFirst.mockResolvedValue({ workspaceId: "ws_1" });

    await expect(assertNotSubscriptionOwner("user_1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "OWNER_OF_ACTIVE_SUBSCRIPTION",
    });
    expect(dbMock.workspaceMember.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        role: "OWNER",
        userId: "user_1",
        workspace: {
          entitlement: {
            accessState: { in: expect.arrayContaining(["ACTIVE"]) },
            sourceSubscriptionId: { not: null },
          },
        },
      },
    });
  });

  it("allows deletion when the user owns no paid workspace", async () => {
    dbMock.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(assertNotSubscriptionOwner("user_1")).resolves.toBeUndefined();
  });
});

describe("seat sync around account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the workspaces the user belongs to", async () => {
    dbMock.workspaceMember.findMany.mockResolvedValue([
      { workspaceId: "ws_1" },
      { workspaceId: "ws_2" },
    ]);

    await expect(listMemberWorkspaceIds("user_1")).resolves.toEqual(["ws_1", "ws_2"]);
  });

  it("re-bills every workspace the deleted user belonged to", async () => {
    seatSyncMock.mockResolvedValue({ quantity: 1, synced: true });

    await syncSeatsAfterUserDeletion(["ws_1", "ws_2"], "user_1");

    expect(seatSyncMock).toHaveBeenCalledTimes(2);
    expect(seatSyncMock).toHaveBeenCalledWith({
      requestId: "user-delete:user_1:ws_1",
      workspaceId: "ws_1",
    });
  });

  it("keeps going when one workspace fails to sync", async () => {
    seatSyncMock.mockRejectedValueOnce(new Error("stripe unavailable")).mockResolvedValueOnce({
      quantity: 1,
      synced: true,
    });

    await expect(syncSeatsAfterUserDeletion(["ws_1", "ws_2"], "user_1")).resolves.toBeUndefined();
    expect(seatSyncMock).toHaveBeenCalledTimes(2);
    expect(logMock.error).toHaveBeenCalled();
  });
});
