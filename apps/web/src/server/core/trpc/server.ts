import crypto from "node:crypto";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

import { TRPC_PREFIX } from "@/shared/config/env.client";
import { IS_DEV } from "@/shared/config/env.flags";
import { WS_COOKIE, WS_HEADER } from "@/shared/lib/workspace-cookie";

import { requestContext } from "@/server/utils/request-context";

import { prisma } from "../db";
import { redisClient } from "../redis";
import { createContext } from "./context";
import { createCallerFactory } from "./init";

// Dynamic because server slices import this file back for `apiForUser`; a static import
// would close the cycle, and deferring keeps the routers out of unrelated entrypoints.
export const apiForUser = cache(async (userId: string) => {
  const { appRouter } = await import("@/server/modules");
  const createCaller = createCallerFactory(appRouter);

  return createCaller(await ctxForUser(userId));
});

export const ctxForUser = cache(
  async (userId: string, apiKeyScopes?: string[], workspaceId?: string) => {
    const user = await prisma.user.findUnique({
      select: {
        banned: true,
        createdAt: true,
        email: true,
        emailVerified: true,
        image: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        updatedAt: true,
      },
      where: { id: userId },
    });

    const protocol = IS_DEV ? "http" : "https";
    const host = "localhost:3000";
    const heads = new Headers();
    heads.set("x-trpc-source", "task");

    if (workspaceId != null) {
      heads.set(WS_HEADER, workspaceId);
    }

    const ctx = {
      ...(apiKeyScopes != null && { apiKeyScopes }),
      prisma,
      redis: redisClient,
      req: new NextRequest(`${protocol}://${host}${TRPC_PREFIX}`, { headers: heads }),
      requestInfo: {
        country: "SYSTEM",
        ip: "127.0.0.1",
        method: "TASK",
        path: "/task",
        requestId: `task-${crypto.randomUUID()}`,
        userAgent: "Doxynix-Task-Runner",
        userId,
        userRole: user?.role,
      },
      session:
        user == null
          ? null
          : {
              session: {
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
                id: "task-session",
                token: "task-token",
                updatedAt: new Date(),
                userId,
              },
              user: {
                banned: user.banned,
                createdAt: user.createdAt,
                email: user.email ?? "",
                emailVerified: user.emailVerified,
                id: userId,
                image: user.image,
                name: user.name ?? "User",
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
                updatedAt: user.updatedAt,
              },
            },
    };

    return ctx;
  },
);

export const api = cache(async () => {
  const { appRouter } = await import("@/server/modules");
  const createCaller = createCallerFactory(appRouter);

  return createCaller(await ctxForRequest());
});

async function readWorkspaceCookie(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();

    return cookieStore.get(WS_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export const ctxForRequest = cache(async () => {
  const store = requestContext.getStore();
  const workspaceId = await readWorkspaceCookie();

  if (store?.userId != null) {
    return ctxForUser(store.userId, store.apiKeyScopes, workspaceId);
  }

  const heads = new Headers();
  try {
    const nextHeads = await headers();
    nextHeads.forEach((value, key) => heads.set(key, value));
  } catch {
    heads.set("x-trpc-source", "rsc");
  }

  const protocol = IS_DEV ? "http" : "https";
  const host = heads.get("host") ?? "localhost:3000";

  if (workspaceId != null) {
    heads.set(WS_HEADER, workspaceId);
  }

  return createContext({
    req: new NextRequest(`${protocol}://${host}${TRPC_PREFIX}`, { headers: heads }),
  });
});
