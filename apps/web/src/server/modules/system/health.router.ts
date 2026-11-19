import { healthCheck } from "@prisma/client/sql";
import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/core/trpc/init";
import { handlePrismaError } from "@/server/utils/handle-error";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .input(z.object({}).optional())
    .output(
      z.object({
        status: z.string(),
      }),
    )
    .query(async ({ ctx }) => {
      try {
        await ctx.prisma.$queryRawTyped(healthCheck());
        return { status: "ok" };
      } catch (error) {
        handlePrismaError(error, {
          defaultConflict: "Service temporarily unavailable",
        });
      }
    }),
});
