import type { PublicUser } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import type { auth } from "@/server/core/auth";
import { formatUserAgent } from "@/server/utils/ua-parser";

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
