import crypto from "node:crypto";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/api/auth/auth-options";
import { prisma } from "@/shared/api/db/db";

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
        where: { hashedKey: hashedToken },
        include: { user: true },
      });

      if (keyRecord != null && !keyRecord.revoked && keyRecord.user != null) {
        prisma.apiKey
          .update({
            where: { id: keyRecord.id },
            data: { lastUsed: new Date() },
          })
          .catch(console.error);

        return {
          req,
          prisma,
          session: {
            user: keyRecord.user,
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          },
          requestInfo,
        };
      }
    }
  }

  const session = await getServerSession(authOptions);
  return {
    req,
    prisma,
    session,
    requestInfo,
    redis: redisClient,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
