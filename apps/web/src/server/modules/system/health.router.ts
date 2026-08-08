import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/core/trpc/init";
import { handlePrismaError } from "@/server/utils/handle-error";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .input(z.object({}).optional())
    .output(
      z.object({
        status: z.string(),
      })
    )
    .query(async ({ ctx }) => {
      try {
        await ctx.prisma.$queryRaw`SELECT 1`;
        return { status: "ok" };
      } catch (error) {
        handlePrismaError(error, {
          defaultConflict: "Service temporarily unavailable",
        });
      }
    }),
});
