import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { getIp, getUa } from "@/server/utils/request-context";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

import { authOptions } from "../auth";
import { prisma } from "../db";
import { redisClient } from "../redis";

type Props = {
  req: NextRequest;
};

export async function createContext({ req }: Props) {
  const ip = getIp(req);
  const userAgent = getUa(req);
  const requestInfo = { ip, userAgent };

  const authHeader = req.headers.get("authorization");
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    if (token != null) {
      const keyRecord = await verifyAndUseApiKey(token);

      if (keyRecord != null) {
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
