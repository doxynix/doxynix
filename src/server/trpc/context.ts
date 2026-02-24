import crypto from "node:crypto";
import { getServerSession } from "next-auth";

import { prisma } from "@/server/db/db";

import { authOptions } from "../auth/options";
import { redisClient } from "../lib/redis";

type Props = {
  req: Request;
};

export async function createContext({ req }: Props) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const requestInfo = { ip, userAgent };

  const authHeader = req.headers.get("authorization");
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    if (token.startsWith("dxnx_")) {
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
          .catch(console.error);

        return {
          prisma,
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
