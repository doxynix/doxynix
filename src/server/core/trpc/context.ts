import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { getIp, getUa } from "@/server/utils/request-context";

import { appLogger } from "../app-logger";
import { authOptions } from "../auth";
import { prisma } from "../db";
import { redisClient } from "../redis";

type Props = {
  req: NextRequest;
};

export async function createContext({ req }: Props) {
  const ip = getIp(req);
  const userAgent = getUa(req);
  const requestInfo = { ip, userAgent }; // NOTE: мб заменить на request-context.ts

  const authHeader = req.headers.get("authorization");
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token != null && token.startsWith("dxnx_")) {
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const keyRecord = await prisma.apiKey.findUnique({
        include: { user: true },
        where: { hashedKey: hashedToken },
      });

      if (keyRecord?.revoked === false) {
        prisma.apiKey
          .update({
            data: { lastUsed: new Date() },
            where: { id: keyRecord.id },
          })
          .catch((error) =>
            appLogger.error({
              error:
                error instanceof Error ? { message: error.message, stack: error.stack } : error,
              keyId: keyRecord.id,
              msg: "Failed to update api key lastUsed",
            })
          );

        return {
          prisma,
          redis: redisClient,
          req,
          requestInfo,
          session: {
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
            user: keyRecord.user,
          },
        };
      }
    }
  }

  const session = await getServerSession(authOptions);
  return {
    prisma,
    redis: redisClient,
    req,
    requestInfo,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
