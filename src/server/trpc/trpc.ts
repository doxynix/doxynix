import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import { Context } from "@/server/trpc/context";

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
