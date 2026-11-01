import { AccessState } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { syncWorkspaceSeats } from "@/server/core/billing/seat-sync";
import { prisma } from "@/server/core/db";

const LIVE_ACCESS_STATES: AccessState[] = [
  AccessState.ACTIVE,
  AccessState.GRACE,
  AccessState.PENDING,
  AccessState.REVIEW,
  AccessState.SUSPENDED,
];

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

      await upsertBillingIssue(prisma, {
        dedupeKey: `seat_sync_failed:${workspaceId}`,
        details: {
          error: error instanceof Error ? error.message : "unknown",
          source: "user_delete",
        },
        kind: "SEAT_SYNC_FAILED",
        severity: "WARNING",
        source: "users",
        workspaceId,
      }).catch((issueError: unknown) => {
        appLogger.error({ error: issueError, msg: "users.seat_sync_issue_failed", workspaceId });
      });
    }
  }
}
