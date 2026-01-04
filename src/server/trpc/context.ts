import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/api/auth/authOptions";
import { prisma } from "@/shared/api/db/db";

type Props = {
  req: Request;
};

export async function createContext({ req }: Props) {
  const authHeader = req.headers.get("authorization");

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    const keyRecord = await prisma.apiKey.findUnique({
      where: { hashedKey: token }, // тут поменять ибо чистый токен с хешом сравнить не выйдет
      include: { user: true },
    });

    if (keyRecord !== null && keyRecord.revoked !== null && keyRecord.user !== null) {
      prisma.apiKey
        .update({
          where: { id: keyRecord.id },
          data: { lastUsed: new Date() },
        })
        .catch(console.error);

      // console.log(`>>> [API KEY] Auth success: ${keyRecord.user.email}`);

      return {
        req,
        prisma,
        session: {
          user: keyRecord.user,
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        },
      };
    }
  }

  const session = await getServerSession(authOptions);
  // if (session) {
  //   console.log(`>>> [SESSION] Auth success: ${session.user?.email}`);
  // }
  return {
    req,
    prisma,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
