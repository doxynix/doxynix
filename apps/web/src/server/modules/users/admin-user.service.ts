import { MAX_PAGE } from "@doxynix/shared";
import type { Prisma, UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { type DbClient, prisma } from "@/server/core/db";
import { revokeUserSessions } from "@/server/utils/access-revocation";
import { assertAdminTotpCode } from "@/server/utils/admin-access";
import { handlePrismaError } from "@/server/utils/handle-error";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
import { normalizeSearchInput } from "@/server/utils/search";

import type {
  AdminDeleteUserInput,
  AdminSetBannedInput,
  AdminSetRoleInput,
  AdminUserSummary,
  AdminUsersFilterInput,
} from "./admin-user.schemas";
import { userMapper } from "./user.mapper";

export type ReauthInput = {
  headers: Headers;
  twoFactorEnabled: boolean;
};

const ACTIVE_ADMIN_WHERE: Prisma.UserWhereInput = { banned: false, role: "ADMIN" };

const ADMIN_USER_SELECT = {
  banExpires: true,
  banned: true,
  banReason: true,
  createdAt: true,
  email: true,
  emailVerified: true,
  id: true,
  image: true,
  lastLoginMethod: true,
  name: true,
  role: true,
  twoFactorEnabled: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const ADMIN_USER_COUNT_SELECT = {
  apiKeys: true,
  chatSession: true,
  notifications: true,
  repos: true,
  sessions: true,
} satisfies Prisma.UserCountOutputTypeSelect;

const NOT_FOUND = "User not found";

export function assertNotActor(input: { isSelf: boolean }): void {
  if (input.isSelf) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "You cannot change your own role, ban status, or delete your own account as an admin.",
    });
  }
}

export function assertNotLastAdmin(input: {
  activeAdminCount: number;
  isTargetAdmin: boolean;
}): void {
  if (input.isTargetAdmin && input.activeAdminCount <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This is the only active admin. Promote another admin before demoting or banning them.",
    });
  }
}

function buildSearchClause(term: string): Prisma.UserWhereInput {
  const clauses: Prisma.UserWhereInput[] = [{ name: { contains: term, mode: "insensitive" } }];

  if (z.uuid().safeParse(term).success) {
    clauses.push({ id: term });
  }

  return { OR: clauses };
}

function countActiveAdmins(db: DbClient): Promise<number> {
  return db.user.count({ where: ACTIVE_ADMIN_WHERE });
}

async function findTarget(db: DbClient, id: string): Promise<{ id: string; role: UserRole }> {
  const target = await db.user.findUnique({ select: { id: true, role: true }, where: { id } });

  if (target == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND });
  }

  return target;
}

async function persistUserUpdate(
  db: DbClient,
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<{ user: AdminUserSummary }> {
  try {
    const updated = await db.user.update({ data, select: ADMIN_USER_SELECT, where: { id } });

    return { user: userMapper.toAdminSummary(updated) };
  } catch (error) {
    return handlePrismaError(error, { notFound: NOT_FOUND });
  }
}

async function assertFreshTotp(input: {
  code?: string;
  headers: Headers;
  twoFactorEnabled: boolean;
}): Promise<void> {
  const code = assertAdminTotpCode({
    code: input.code,
    twoFactorEnabled: input.twoFactorEnabled,
  });

  try {
    await auth.api.verifyTOTP({
      body: { code },
      headers: input.headers,
    });
  } catch (error) {
    appLogger.warn({ error, msg: "Admin re-authentication failed" });

    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "That confirmation code is not valid.",
    });
  }
}

export const adminUserService = {
  buildWhereClause(filters: Partial<AdminUsersFilterInput>): Prisma.UserWhereInput {
    const term = normalizeSearchInput(filters.search);
    const roleFilter = filters.role != null ? { role: filters.role } : {};
    const bannedFilter = filters.banned != null ? { banned: filters.banned } : {};
    const searchFilter = term != null ? buildSearchClause(term) : {};

    return {
      ...roleFilter,
      ...bannedFilter,
      ...buildDateRangeWhere(filters, "createdAt"),
      ...searchFilter,
    };
  },

  async deleteUser(
    db: DbClient,
    actorId: string,
    input: AdminDeleteUserInput,
    reauth: ReauthInput,
  ) {
    const target = await findTarget(db, input.id);

    assertNotActor({ isSelf: target.id === actorId });
    assertNotLastAdmin({
      activeAdminCount: await countActiveAdmins(db),
      isTargetAdmin: target.role === "ADMIN",
    });

    await assertFreshTotp({
      code: input.code,
      headers: reauth.headers,
      twoFactorEnabled: reauth.twoFactorEnabled,
    });

    try {
      await db.user.delete({ where: { id: input.id } });

      return { success: true };
    } catch (error) {
      return handlePrismaError(error, { notFound: NOT_FOUND });
    }
  },

  async getAll(db: DbClient, input: AdminUsersFilterInput) {
    const { limit, page } = input;

    const where = this.buildWhereClause(input);
    const isUnfiltered = Object.keys(where).length === 0;

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.UserWhereInput) =>
      cappedCount(
        (take) => db.user.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered: isUnfiltered ? null : () => countMatching({}),
      fetchItems: ({ skip, take }) =>
        db.user.findMany({
          orderBy: ORDER_CREATED_AT_DESC,
          select: ADMIN_USER_SELECT,
          skip,
          take,
          where,
        }),
      input: { limit, page, ...(input.search != null ? { search: input.search } : {}) },
    });

    return { items: items.map((item) => userMapper.toAdminSummary(item)), meta };
  },

  async getDetail(db: DbClient, id: string) {
    const user = await db.user.findUnique({
      select: { ...ADMIN_USER_SELECT, _count: { select: ADMIN_USER_COUNT_SELECT } },
      where: { id },
    });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND });
    }

    return userMapper.toAdminDetail(user);
  },

  async getSessions(db: DbClient, userId: string) {
    const now = Date.now();
    const sessions = await db.session.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        ipAddress: true,
        userAgent: true,
      },
      where: { userId },
    });

    return {
      items: sessions.map((session) => ({
        createdAt: session.createdAt,
        expired: session.expiresAt.getTime() <= now,
        expiresAt: session.expiresAt,
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })),
    };
  },

  async revokeSession(db: DbClient, sessionId: string) {
    const session = await prisma.session.findUnique({
      select: { token: true, userId: true },
      where: { id: sessionId },
    });

    if (session == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
    }

    try {
      const authContext = await auth.$context;

      await authContext.internalAdapter.deleteSession(session.token);
    } catch (error) {
      appLogger.error({ error, msg: "Session cache could not be cleared", sessionId });
    }

    await db.session.deleteMany({ where: { id: sessionId } });

    return { success: true };
  },

  async setBanned(db: DbClient, actorId: string, input: AdminSetBannedInput, reauth: ReauthInput) {
    const target = await findTarget(db, input.id);

    if (input.banned) {
      assertNotActor({ isSelf: target.id === actorId });
      assertNotLastAdmin({
        activeAdminCount: await countActiveAdmins(db),
        isTargetAdmin: target.role === "ADMIN",
      });

      if (input.banExpires != null && input.banExpires.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A ban expiry must be in the future.",
        });
      }

      await assertFreshTotp({
        code: input.code,
        headers: reauth.headers,
        twoFactorEnabled: reauth.twoFactorEnabled,
      });
    }

    const updated = await persistUserUpdate(db, input.id, {
      banExpires: input.banned ? (input.banExpires ?? null) : null,
      banned: input.banned,
      banReason: input.banned ? (input.banReason ?? null) : null,
    });

    if (input.banned) {
      await revokeUserSessions(db, input.id);
    }

    return updated;
  },

  async setRole(db: DbClient, actorId: string, input: AdminSetRoleInput) {
    const target = await findTarget(db, input.id);

    assertNotActor({ isSelf: target.id === actorId });

    if (target.role === "ADMIN" && input.role !== "ADMIN") {
      assertNotLastAdmin({ activeAdminCount: await countActiveAdmins(db), isTargetAdmin: true });
    }

    return persistUserUpdate(db, input.id, { role: input.role });
  },
};
