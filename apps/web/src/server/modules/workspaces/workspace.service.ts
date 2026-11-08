import { createHash, randomBytes } from "node:crypto";

import { MessageCode, PlanCode, PlanCodeSchema, type WorkspaceRole } from "@doxynix/shared";
import { Prisma } from "@prisma/client";

import { APP_URL } from "@/shared/config/env.client";

import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { upsertBillingIssue } from "@/server/core/billing/issue";
import { syncWorkspaceSeats } from "@/server/core/billing/seat-sync";
import { type DbClient, prisma } from "@/server/core/db";
import { resolveWorkspace } from "@/server/core/workspaces/resolve-workspace";
import { sendWorkspaceInviteEmail } from "@/server/core/workspaces/send-workspace-invite";
import { maskEmail, normalizeEmail } from "@/server/utils/email-guard";
import { getNormalizedHash } from "@/server/utils/hash";

import type { WorkspaceSummary } from "./workspace.schemas";

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

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invalidInvite(): AppError {
  return new AppError({
    code: "NOT_FOUND",
    messageCode: MessageCode.INVITE_INVALID,
    publicMessage: "INVITE_INVALID",
  });
}

export const workspaceService = {
  async acceptInvite(token: string, userId: string) {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
    });

    if (invite == null || invite.expiresAt.getTime() <= Date.now()) {
      throw invalidInvite();
    }

    // Email invitations are identity-bound: only the invited address may redeem the link. Open
    // share links have no emailHash and stay usable by anyone holding them.
    if (invite.emailHash != null) {
      const user = await prisma.user.findUnique({
        select: { emailHash: true },
        where: { id: userId },
      });

      if (user?.emailHash !== invite.emailHash) {
        throw invalidInvite();
      }
    }

    const workspace = await prisma.workspace.findUnique({
      include: { entitlement: true },
      where: { id: invite.workspaceId },
    });

    if (workspace == null) {
      throw new AppError({
        code: "FORBIDDEN",
        messageCode: MessageCode.WORKSPACE_ACCESS_DENIED,
        publicMessage: "Workspace access denied",
      });
    }

    if (workspace.entitlement == null || workspace.entitlement.planCode === "HOBBY") {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        messageCode: MessageCode.FEATURE_NOT_IN_PLAN,
        publicMessage: "UPGRADE_REQUIRED",
      });
    }

    if (workspace.entitlement.accessState !== "ACTIVE") {
      throw new AppError({
        code: "PAYMENT_REQUIRED",
        messageCode: MessageCode.PAYMENT_REQUIRED,
        publicMessage: "PAYMENT_REQUIRED",
      });
    }

    const memberId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invite.workspaceId}))`;

      // Single-use: the first accept wins, and a concurrent second one rolls back.
      const claimed = await tx.$executeRaw`
        UPDATE "workspace_invites"
        SET "accepted_at" = now()
        WHERE "id" = ${invite.id}::uuid AND "accepted_at" IS NULL
      `;

      if (claimed === 0) {
        throw invalidInvite();
      }

      const existing = await tx.workspaceMember.findUnique({
        select: { id: true },
        where: { workspaceId_userId: { userId, workspaceId: invite.workspaceId } },
      });

      if (existing != null) {
        return existing.id;
      }

      const created = await tx.workspaceMember.create({
        data: { role: "MEMBER", userId, workspaceId: invite.workspaceId },
        select: { id: true },
      });

      return created.id;
    });

    await syncSeatsAfterMembershipChange({ requestId: memberId, workspaceId: invite.workspaceId });

    appLogger.info({
      msg: "Workspace invite accepted",
      type: "workspace.invite_accepted",
      userId,
      workspaceId: invite.workspaceId,
    });

    return { workspaceId: invite.workspaceId };
  },
  async addMember(db: DbClient, workspaceId: string, email: string) {
    const workspace = await db.workspace.findUnique({
      include: { entitlement: true },
      where: { id: workspaceId },
    });

    if (workspace == null) {
      throw new AppError({
        code: "FORBIDDEN",
        messageCode: MessageCode.WORKSPACE_ACCESS_DENIED,
        publicMessage: "Workspace access denied",
      });
    }

    if (workspace.entitlement == null || workspace.entitlement.planCode === "HOBBY") {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        messageCode: MessageCode.FEATURE_NOT_IN_PLAN,
        publicMessage: "UPGRADE_REQUIRED",
      });
    }

    // A seat is a paid resource: §9.7 forbids raising seats while the subscription is not active,
    // so grace keeps its existing seats but cannot grow. Suspended/review have no access at all.
    if (workspace.entitlement.accessState !== "ACTIVE") {
      throw new AppError({
        code: "PAYMENT_REQUIRED",
        messageCode: MessageCode.PAYMENT_REQUIRED,
        publicMessage: "PAYMENT_REQUIRED",
      });
    }

    const emailHash = getNormalizedHash(normalizeEmail(email));
    // Membership lookup is a system read: a workspace owner must not be able to read the user row.
    const user = await prisma.user.findUnique({
      select: { id: true, image: true, name: true },
      where: { emailHash },
    });

    if (user == null) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        messageCode: MessageCode.MEMBER_ADD_FAILED,
        publicMessage: "MEMBER_ADD_FAILED",
      });
    }

    if (!("$transaction" in db)) {
      throw new AppError({
        code: "INTERNAL_SERVER_ERROR",
        messageCode: MessageCode.WORKSPACE_DB_CLIENT_MISSING,
        publicMessage: "Workspace mutation requires a database client",
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
          throw new AppError({
            code: "CONFLICT",
            messageCode: MessageCode.MEMBER_ALREADY_EXISTS,
            publicMessage: "ALREADY_MEMBER",
          });
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
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError({
          code: "CONFLICT",
          messageCode: MessageCode.MEMBER_ALREADY_EXISTS,
          publicMessage: "ALREADY_MEMBER",
        });
      }

      throw error;
    }
  },

  async createInvite(
    workspaceId: string,
    createdByUserId: string,
    input: { email?: string; inviterName?: string } = {},
  ) {
    const workspace = await prisma.workspace.findUnique({
      include: { entitlement: true },
      where: { id: workspaceId },
    });

    if (workspace == null) {
      throw new AppError({
        code: "FORBIDDEN",
        messageCode: MessageCode.WORKSPACE_ACCESS_DENIED,
        publicMessage: "Workspace access denied",
      });
    }

    if (workspace.entitlement == null || workspace.entitlement.planCode === "HOBBY") {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        messageCode: MessageCode.FEATURE_NOT_IN_PLAN,
        publicMessage: "UPGRADE_REQUIRED",
      });
    }

    if (workspace.entitlement.accessState !== "ACTIVE") {
      throw new AppError({
        code: "PAYMENT_REQUIRED",
        messageCode: MessageCode.PAYMENT_REQUIRED,
        publicMessage: "PAYMENT_REQUIRED",
      });
    }

    const email =
      input.email == null || input.email.trim() === "" ? undefined : normalizeEmail(input.email);
    const emailHash = email == null ? undefined : getNormalizedHash(email);

    if (email != null && emailHash != null) {
      const existingUser = await prisma.user.findUnique({
        select: { id: true },
        where: { emailHash },
      });

      if (existingUser != null) {
        const existingMember = await prisma.workspaceMember.findUnique({
          select: { id: true },
          where: { workspaceId_userId: { userId: existingUser.id, workspaceId } },
        });

        if (existingMember != null) {
          throw new AppError({
            code: "CONFLICT",
            messageCode: MessageCode.MEMBER_ALREADY_EXISTS,
            publicMessage: "ALREADY_MEMBER",
          });
        }
      }
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await prisma.workspaceInvite.create({
      data: {
        createdByUserId,
        emailHash,
        expiresAt,
        tokenHash: hashInviteToken(token),
        workspaceId,
      },
    });

    let emailSent = false;

    if (email != null) {
      emailSent = await sendWorkspaceInviteEmail({
        expiresAt,
        inviterName: input.inviterName?.trim() || "Doxynix",
        to: email,
        url: `${APP_URL}/invite/${token}`,
        workspaceName: workspace.name,
      });

      appLogger.info({
        email: maskEmail(email),
        msg: "Workspace invite created",
        type: "workspace.invite_created",
        workspaceId,
      });
    }

    return { emailSent, expiresAt, token };
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

  async previewInvite(token: string) {
    const invite = await prisma.workspaceInvite.findUnique({
      select: {
        acceptedAt: true,
        expiresAt: true,
        workspace: { select: { name: true } },
      },
      where: { tokenHash: hashInviteToken(token) },
    });

    const valid =
      invite != null && invite.acceptedAt == null && invite.expiresAt.getTime() > Date.now();

    return {
      valid,
      workspaceName: invite?.workspace.name ?? null,
    };
  },

  async removeMember(db: DbClient, workspaceId: string, userId: string) {
    if (!("$transaction" in db)) {
      throw new AppError({
        code: "INTERNAL_SERVER_ERROR",
        messageCode: MessageCode.WORKSPACE_DB_CLIENT_MISSING,
        publicMessage: "Workspace mutation requires a database client",
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
            throw new AppError({
              code: "NOT_FOUND",
              messageCode: MessageCode.MEMBER_NOT_FOUND,
              publicMessage: "Member not found",
            });
          }

          const ownerCount = members.filter((member) => member.role === "OWNER").length;

          if (target.role === "OWNER" && ownerCount <= 1) {
            throw new AppError({
              code: "PRECONDITION_FAILED",
              messageCode: MessageCode.MEMBER_LAST_OWNER,
              publicMessage: "LAST_OWNER",
            });
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
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new AppError({
          code: "CONFLICT",
          messageCode: MessageCode.REQUEST_INVALID,
          publicMessage: "CONCURRENT_WORKSPACE_UPDATE",
        });
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
      throw new AppError({
        code: "FORBIDDEN",
        messageCode: MessageCode.WORKSPACE_ACCESS_DENIED,
        publicMessage: "Workspace access denied",
      });
    }

    return toSummary(membership.workspace, membership.role);
  },
};
