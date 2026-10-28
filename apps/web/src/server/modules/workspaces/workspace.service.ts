import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { type DbClient, prisma } from "@/server/core/db";
import { createPersonalWorkspace } from "@/server/core/workspaces/personal-workspace";
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
            planCode: entitlement.planCode,
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
      select: { id: true, name: true },
      where: { emailHash },
    });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const existing = await db.workspaceMember.findUnique({
      select: { id: true },
      where: { workspaceId_userId: { userId: user.id, workspaceId } },
    });

    if (existing != null) {
      throw new TRPCError({ code: "CONFLICT", message: "ALREADY_MEMBER" });
    }

    const activeMembers = await db.workspaceMember.count({ where: { workspaceId } });

    if (workspace.entitlement.seatLimit > 0 && activeMembers >= workspace.entitlement.seatLimit) {
      throw new TRPCError({ code: "FORBIDDEN", message: "LIMIT_EXCEEDED" });
    }

    const member = await db.workspaceMember.create({
      data: { role: "MEMBER", userId: user.id, workspaceId },
      select: { id: true, role: true, userId: true },
    });

    return { ...member, user: { id: user.id, name: user.name } };
  },

  async listForUser(
    db: DbClient,
    userId: string,
    name?: null | string,
  ): Promise<Array<WorkspaceSummary>> {
    await createPersonalWorkspace(userId, name);

    const memberships = await db.workspaceMember.findMany({
      include: { workspace: { include: { entitlement: true } } },
      orderBy: { createdAt: "asc" },
      where: { userId },
    });

    return memberships.map((membership) => toSummary(membership.workspace, membership.role));
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
