import { z } from "zod";

import { handlePrismaError } from "@/server/utils/handle-prisma-error";

import { OpenApiErrorResponses } from "../shared";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .meta({
      openapi: {
        description:
          "Checks the current status and availability of the service. Returns basic operational information to confirm that the service is running correctly.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/health",
        summary: "Service health check",
        tags: ["health"],
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
