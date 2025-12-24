import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/api/auth/authOptions";
import { prisma } from "@/shared/api/db/db";

import { CreateContextOptions } from "@/server/trpc/types";

export async function createContext({ req }: CreateContextOptions) {
  const session = await getServerSession(authOptions);

  return {
    req,
    prisma,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
