import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";

const LIVE_ACCESS_STATES = ["ACTIVE", "GRACE", "PENDING", "REVIEW", "SUSPENDED"];

// Deleting the only OWNER leaves the subscription without anyone who can open the Portal, while
// Stripe keeps charging. Ownership has to move (or the subscription has to end) first.
export async function assertNotSubscriptionOwner(db: DbClient, userId: string): Promise<void> {
  const owned = await db.workspaceMember.findFirst({
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
