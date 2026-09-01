import crypto from "node:crypto";

import { cache } from "react";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

import { TRPC_PREFIX } from "@/shared/constants/env.client";
import { IS_DEV } from "@/shared/constants/env.flags";

import { requestContext } from "@/server/utils/request-context";

import { prisma } from "../db";
import { redisClient } from "../redis";
import { createContext } from "./context";
import { createCallerFactory } from "./init";

export const apiForUser = cache(async (userId: number) => {
  const { appRouter } = await import("@/server/modules");
  const createCaller = createCallerFactory(appRouter);

  const user = await prisma.user.findUnique({
    select: {
      banned: true,
      createdAt: true,
      email: true,
      emailVerified: true,
      image: true,
      name: true,
      publicId: true,
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

  const ctx = {
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
      userId: Number(userId),
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
              userId: String(userId),
            },
            user: {
              banned: user.banned,
              createdAt: user.createdAt,
              email: user.email ?? "",
              emailVerified: user.emailVerified,
              id: String(userId),
              image: user.image,
              name: user.name ?? "User",
              role: user.role,
              twoFactorEnabled: user.twoFactorEnabled,
              updatedAt: user.updatedAt,
            },
          },
  };

  return createCaller(ctx);
});

export const api = cache(async () => {
  const store = requestContext.getStore();
  if (store?.userId != null) {
    return apiForUser(store.userId);
  }

  const { appRouter } = await import("@/server/modules");
  const createCaller = createCallerFactory(appRouter);

  const heads = new Headers();
  try {
    const nextHeads = await headers();
    nextHeads.forEach((value, key) => heads.set(key, value));
  } catch {
    heads.set("x-trpc-source", "rsc");
  }

  const protocol = IS_DEV ? "http" : "https";
  const host = heads.get("host") ?? "localhost:3000";

  const ctx = await createContext({
    req: new NextRequest(`${protocol}://${host}${TRPC_PREFIX}`, { headers: heads }),
  });

  return createCaller(ctx);
});
