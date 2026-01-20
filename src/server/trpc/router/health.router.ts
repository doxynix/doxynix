import { z } from "zod";

import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";
import { handlePrismaError } from "@/server/utils/handlePrismaError";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/health",
        tags: ["health"],
        summary: "Service health check",
        description:
          "Checks the current status and availability of the service. Returns basic operational information to confirm that the service is running correctly.",
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
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
