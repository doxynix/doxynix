import { PlanCode, PlanCodeSchema } from "@doxynix/shared";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { isLocalBillingUpgradeEnabled } from "@/shared/config/env.flags";

import { type DbClient, prisma } from "@/server/core/db";
import { resolveWorkspace } from "@/server/core/workspaces/resolve-workspace";
import { normalizeEmail } from "@/server/utils/email-guard";
import { getNormalizedHash } from "@/server/utils/hash";

import { PRO_ENTITLEMENT, type WorkspaceSummary } from "./workspace.schemas";

type WorkspaceRole = "MEMBER" | "OWNER";

type WorkspaceWithEntitlement = Prisma.WorkspaceGetPayload<{
  include: { entitlement: true };
}>;

function requireOwner(role: WorkspaceRole): void {
  if (role !== "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner rights required" });
  }
}

function toSummary(workspace: WorkspaceWithEntitlement, role: WorkspaceRole): WorkspaceSummary {
  const { entitlement } = workspace;

  return {
    entitlement:
      entitlement == null
        ? null
        : {
            aiTokensPerMonth: entitlement.aiTokensPerMonth,
            analysesPerMonth: entitlement.analysesPerMonth,
            autoResync: entitlement.autoResync,
            historyDays: entitlement.historyDays,
            // Fail closed: an unknown plan value degrades to HOBBY instead of throwing on read.
            planCode: PlanCodeSchema.catch(PlanCode.HOBBY).parse(entitlement.planCode),
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
  async addMember(db: DbClient, workspaceId: string, role: WorkspaceRole, email: string) {
    requireOwner(role);

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
      return await db.$transaction(async (tx) => {
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

        const activeMembers = await tx.workspaceMember.count({ where: { workspaceId } });
        const seatLimit = workspace.entitlement?.seatLimit ?? 0;

        if (seatLimit > 0 && activeMembers >= seatLimit) {
          throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_EXCEEDED" });
        }

        const member = await tx.workspaceMember.create({
          data: { role: "MEMBER", userId: user.id, workspaceId },
          select: { id: true, role: true, userId: true },
        });

        return { ...member, user: { id: user.id, image: user.image, name: user.name } };
      });
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

  async removeMember(db: DbClient, workspaceId: string, role: WorkspaceRole, userId: string) {
    requireOwner(role);

    if (!("$transaction" in db)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Workspace mutation requires a database client",
      });
    }

    try {
      await db.$transaction(
        async (tx) => {
          const members = await tx.workspaceMember.findMany({
            select: { role: true, userId: true },
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

          await tx.workspaceMember.delete({
            where: { workspaceId_userId: { userId, workspaceId } },
          });
        },
        { isolationLevel: "Serializable" },
      );
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

  async upgradeToPro(db: DbClient, workspaceId: string, role: WorkspaceRole) {
    requireOwner(role);

    // TODO(DXNX-293): PLACEHOLDER for local dev only. seatLimit = members+1 is not a real
    // quantity; BILL-06 replaces this path with Stripe Checkout and subscription quantity sync.
    if (!isLocalBillingUpgradeEnabled()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "BILLING_NOT_READY" });
    }

    const workspace = await db.workspace.findUnique({
      include: { entitlement: true, members: { select: { userId: true } } },
      where: { id: workspaceId },
    });

    if (workspace == null) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Workspace access denied" });
    }

    const entitlement = await db.workspaceEntitlement.update({
      data: {
        ...PRO_ENTITLEMENT,
        // Stripe owns the real quantity from BILL-06; one seat keeps the local upgrade usable.
        seatLimit: Math.max(workspace.members.length + 1, 1),
      },
      where: { workspaceId },
    });

    const updated: WorkspaceWithEntitlement = { ...workspace, entitlement };

    return toSummary(updated, role);
  },
};
