import type { NextRequest } from "next/server";

import { auth } from "@/server/core/auth";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

import { prisma } from "../db";
import { redisClient } from "../redis";

type Props = {
  req: NextRequest;
};

export async function createContext({ req }: Props) {
  let store = requestContext.getStore();

  if (store == null) {
    store = buildRequestStore({
      method: req.method,
      path: req.nextUrl.pathname,
      req,
    });
  }

  let sessionContext: NonNullable<typeof auth.$Infer.Session> | null = null;

  const authHeader = req.headers.get("authorization");
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    if (token != null) {
      const keyRecord = await verifyAndUseApiKey(token);

      if (keyRecord != null) {
        sessionContext = {
          session: {
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            id: "api-key",
            token: "api-key",
            userId: String(keyRecord.user.id),
          },
          user: {
            email: keyRecord.user.email,
            id: String(keyRecord.user.id),
            image: keyRecord.user.image,
            name: keyRecord.user.name,
            role: keyRecord.user.role,
          },
        } as any;
      }
    }
  }

  if (sessionContext == null) {
    sessionContext = await auth.api.getSession({
      headers: req.headers,
    });
  }

  if (sessionContext?.user != null) {
    store.userId = Number(sessionContext.user.id);
    store.userRole = sessionContext.user.role;
  }

  return {
    prisma,
    redis: redisClient,
    req,
    requestInfo: store,
    session: sessionContext,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
