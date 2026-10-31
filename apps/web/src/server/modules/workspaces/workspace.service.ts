import { PlanCode, PlanCodeSchema } from "@doxynix/shared";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { syncWorkspaceSeats } from "@/server/core/billing/seat-sync";
import { type DbClient, prisma } from "@/server/core/db";
import { resolveWorkspace } from "@/server/core/workspaces/resolve-workspace";
import { normalizeEmail } from "@/server/utils/email-guard";
import { getNormalizedHash } from "@/server/utils/hash";

import type { WorkspaceSummary } from "./workspace.schemas";

type WorkspaceRole = "MEMBER" | "OWNER";

type WorkspaceWithEntitlement = Prisma.WorkspaceGetPayload<{
  include: { entitlement: true };
}>;

// The membership is already committed, so a failing Stripe call or issue insert must never reach
// the caller; it is logged and recorded instead.
async function syncSeatsAfterMembershipChange(input: {
  requestId: string;
  workspaceId: string;
}): Promise<void> {
  try {
    await syncWorkspaceSeats(input);
  } catch (error) {
    const details = {
      error: error instanceof Error ? error.message : "unknown",
      requestId: input.requestId,
    };

    appLogger.error({
      error,
      msg: "workspace.seat_sync_failed",
      requestId: input.requestId,
      workspaceId: input.workspaceId,
    });

    try {
      // BillingIssue denies `create` to every policy role, so the issue must go through the
      // system client; the enhanced one would silently drop it.
      await upsertBillingIssue(prisma, {
        dedupeKey: `seat_sync_failed:${input.workspaceId}`,
        details,
        kind: "SEAT_SYNC_FAILED",
        severity: "WARNING",
        source: "workspace",
        workspaceId: input.workspaceId,
      });
    } catch (issueError) {
      appLogger.error({
        error: issueError,
        msg: "workspace.seat_sync_issue_failed",
        workspaceId: input.workspaceId,
      });
    }
  }
}

function toSummary(workspace: WorkspaceWithEntitlement, role: WorkspaceRole): WorkspaceSummary {
  const { entitlement } = workspace;

  // Fail closed: an unknown plan value degrades to HOBBY instead of throwing on read.
  const parsedPlan = PlanCodeSchema.safeParse(entitlement?.planCode);
  const planCode = parsedPlan.success ? parsedPlan.data : PlanCode.HOBBY;

  return {
    entitlement:
      entitlement == null
        ? null
        : {
            aiTokensPerMonth: entitlement.aiTokensPerMonth,
            analysesPerMonth: entitlement.analysesPerMonth,
            autoResync: entitlement.autoResync,
            historyDays: entitlement.historyDays,
            planCode,
            privateReposAllowed: entitlement.privateReposAllowed,
            prReviews: entitlement.prReviews,
            reposLimit: entitlement.reposLimit,
            seatLimit: entitlement.seatLimit,
          },
    id: workspace.id,
    name: workspace.name,
    role,
  };
}

export const workspaceService = {
  async addMember(db: DbClient, workspaceId: string, email: string) {
    const workspace = await db.workspace.findUnique({
      include: { entitlement: true },
      where: { id: workspaceId },
    });

    if (workspace == null) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Workspace access denied" });
    }

    if (workspace.entitlement == null || workspace.entitlement.planCode === "HOBBY") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "UPGRADE_REQUIRED" });
    }

    // A seat is a paid resource: adding people while the subscription is suspended, in review or
    // in grace would create capacity nobody has paid for.
    if (workspace.entitlement.accessState !== "ACTIVE") {
      throw new AppError({ code: "PAYMENT_REQUIRED", publicMessage: "PAYMENT_REQUIRED" });
    }

    const emailHash = getNormalizedHash(normalizeEmail(email));
    // Membership lookup is a system read: a workspace owner must not be able to read the user row.
    const user = await prisma.user.findUnique({
      select: { id: true, image: true, name: true },
      where: { emailHash },
    });

    if (user == null) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "MEMBER_ADD_FAILED" });
    }

    if (!("$transaction" in db)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Workspace mutation requires a database client",
      });
    }

    try {
      const member = await db.$transaction(async (tx) => {
        // Serialises seat accounting per workspace; without it two concurrent adds both pass the
        // seatLimit check and create an unpaid seat.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;

        const existing = await tx.workspaceMember.findUnique({
          select: { id: true },
          where: { workspaceId_userId: { userId: user.id, workspaceId } },
        });

        if (existing != null) {
          throw new TRPCError({ code: "CONFLICT", message: "ALREADY_MEMBER" });
        }

        // Seats are not pre-purchased: the subscription quantity follows the membership count, and
        // the sync below invoices the extra seat with `always_invoice`.
        const created = await tx.workspaceMember.create({
          data: { role: "MEMBER", userId: user.id, workspaceId },
          select: { id: true, role: true, userId: true },
        });

        return { ...created, user: { id: user.id, image: user.image, name: user.name } };
      });

      await syncSeatsAfterMembershipChange({ requestId: member.id, workspaceId });

      return member;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new TRPCError({ code: "CONFLICT", message: "ALREADY_MEMBER" });
      }

      throw error;
    }
  },

  async listForUser(
    db: DbClient,
    userId: string,
    headerWorkspaceId: null | string,
    name?: null | string,
  ) {
    const resolved = await resolveWorkspace({ headerWorkspaceId, name, userId });

    const memberships = await db.workspaceMember.findMany({
      include: { workspace: { include: { entitlement: true } } },
      orderBy: { createdAt: "asc" },
      where: { userId },
    });

    return {
      activeWorkspaceId: resolved.id,
      items: memberships.map((membership) => toSummary(membership.workspace, membership.role)),
      reset: resolved.reset,
    };
  },

  async listMembers(db: DbClient, workspaceId: string) {
    return db.workspaceMember.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, image: true, name: true } },
        userId: true,
      },
      where: { workspaceId },
    });
  },

  async removeMember(db: DbClient, workspaceId: string, userId: string) {
    if (!("$transaction" in db)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Workspace mutation requires a database client",
      });
    }

    try {
      const removedId = await db.$transaction(
        async (tx) => {
          const members = await tx.workspaceMember.findMany({
            select: { id: true, role: true, userId: true },
            where: { workspaceId },
          });

          const target = members.find((member) => member.userId === userId);

          if (target == null) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
          }

          const ownerCount = members.filter((member) => member.role === "OWNER").length;

          if (target.role === "OWNER" && ownerCount <= 1) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "LAST_OWNER" });
          }

          const deleted = await tx.workspaceMember.delete({
            select: { id: true },
            where: { workspaceId_userId: { userId, workspaceId } },
          });

          return deleted.id;
        },
        { isolationLevel: "Serializable" },
      );

      await syncSeatsAfterMembershipChange({
        requestId: `remove:${removedId}`,
        workspaceId,
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new TRPCError({ code: "CONFLICT", message: "CONCURRENT_WORKSPACE_UPDATE" });
      }

      throw error;
    }
  },

  async switchWorkspace(db: DbClient, workspaceId: string, userId: string) {
    const membership = await db.workspaceMember.findUnique({
      include: { workspace: { include: { entitlement: true } } },
      where: { workspaceId_userId: { userId, workspaceId } },
    });

    if (membership == null) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Workspace access denied" });
    }

    return toSummary(membership.workspace, membership.role);
  },
};
