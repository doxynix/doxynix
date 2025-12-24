import { CreateContextOptions } from "@/server/trpc/types";
import { prisma } from "@/shared/api/db/db";

export async function createContext({ req }: CreateContextOptions) {
  // const session = await getServerSession(...)

  return {
    req,
    prisma,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
