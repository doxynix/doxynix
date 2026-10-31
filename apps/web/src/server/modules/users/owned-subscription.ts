import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";
import { syncWorkspaceSeats } from "@/server/core/billing/seat-sync";
import { prisma } from "@/server/core/db";

const LIVE_ACCESS_STATES = ["ACTIVE", "GRACE", "PENDING", "REVIEW", "SUSPENDED"];

// Deleting the only OWNER leaves the subscription without anyone who can open the Portal, while
// Stripe keeps charging. Ownership has to move (or the subscription has to end) first.
export async function assertNotSubscriptionOwner(userId: string): Promise<void> {
  // System read: the admin path is filtered by the workspace policies otherwise, and a filtered
  // `null` would let the check pass silently.
  const owned = await prisma.workspaceMember.findFirst({
    select: { workspaceId: true },
    where: {
      role: "OWNER",
      userId,
      workspace: {
        entitlement: {
          accessState: { in: LIVE_ACCESS_STATES },
          sourceSubscriptionId: { not: null },
        },
      },
    },
  });

  if (owned != null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "OWNER_OF_ACTIVE_SUBSCRIPTION",
    });
  }
}

// Membership rows disappear with the user, so the workspaces have to be collected before the
// delete and re-billed after it — otherwise the remaining members keep the old seat count.
export async function listMemberWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    select: { workspaceId: true },
    where: { userId },
  });

  return memberships.map((membership) => membership.workspaceId);
}

export async function syncSeatsAfterUserDeletion(
  workspaceIds: string[],
  userId: string,
): Promise<void> {
  for (const workspaceId of workspaceIds) {
    try {
      await syncWorkspaceSeats({
        requestId: `user-delete:${userId}:${workspaceId}`,
        workspaceId,
      });
    } catch (error) {
      appLogger.error({
        error,
        msg: "users.seat_sync_after_delete_failed",
        userId,
        workspaceId,
      });
    }
  }
}
