import type { PublicUser } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import type { auth } from "@/server/core/auth";
import { formatUserAgent } from "@/server/utils/ua-parser";

import type { AdminUserDetail, AdminUserSummary } from "./admin-user.schemas";

type UserRecord = {
  createdAt: Date;
  email: string | null;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string | null;
  role: PublicUser["role"];
  updatedAt: Date;
};

type SessionRecord = Awaited<ReturnType<typeof auth.api.listSessions>>[number];

type AdminUserSummaryRecord = {
  banExpires: Date | null;
  banReason: string | null;
  banned: boolean;
  createdAt: Date;
  email: string | null;
  emailVerified: boolean;
  id: string;
  image: string | null;
  lastLoginMethod: string | null;
  name: string | null;
  role: PublicUser["role"];
  twoFactorEnabled: boolean;
  updatedAt: Date;
};

type AdminUserDetailRecord = AdminUserSummaryRecord & {
  _count: {
    apiKeys: number;
    chatSession: number;
    notifications: number;
    repos: number;
    sessions: number;
  };
};

type LinkedAccountRecord = Prisma.AccountGetPayload<{
  select: {
    accountId: true;
    email: true;
    image: true;
    name: true;
    providerId: true;
  };
}>;

export const userMapper = {
  toAdminDetail(user: AdminUserDetailRecord): AdminUserDetail {
    return {
      ...this.toAdminSummary(user),
      counts: {
        apiKeys: user._count.apiKeys,
        chatSessions: user._count.chatSession,
        notifications: user._count.notifications,
        repos: user._count.repos,
        sessions: user._count.sessions,
      },
    };
  },

  toAdminSummary(user: AdminUserSummaryRecord): AdminUserSummary {
    return {
      banExpires: user.banExpires,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      image: user.image,
      lastLoginMethod: user.lastLoginMethod,
      name: user.name,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      updatedAt: user.updatedAt,
    };
  },

  toLinkedAccount(account: LinkedAccountRecord) {
    return {
      accountId: account.accountId,
      email: account.email,
      image: account.image,
      name: account.name,
      provider: account.providerId,
    };
  },

  toPublic(user: UserRecord): PublicUser {
    return {
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      image: user.image,
      name: user.name,
      role: user.role,
      updatedAt: user.updatedAt,
    };
  },

  toSession(session: SessionRecord) {
    return {
      createdAt: session.createdAt,
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: formatUserAgent(session.userAgent ?? null),
    };
  },
};
