import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { assertNotSubscriptionOwner } from "./owned-subscription";

function fakeDb(result: unknown) {
  const findFirst = vi.fn().mockResolvedValue(result);

  return { db: { workspaceMember: { findFirst } } as unknown as DbClient, findFirst };
}

describe("assertNotSubscriptionOwner", () => {
  it("refuses to delete a user who owns a workspace with a live subscription", async () => {
    const { db, findFirst } = fakeDb({ workspaceId: "ws_1" });

    await expect(assertNotSubscriptionOwner(db, "user_1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "OWNER_OF_ACTIVE_SUBSCRIPTION",
    });
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
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
    const { db } = fakeDb(null);

    await expect(assertNotSubscriptionOwner(db, "user_1")).resolves.toBeUndefined();
  });
});
