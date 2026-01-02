import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { OpenApiErrorResponses } from "@/server/trpc/shared";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/trpc";

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
        console.error("Health check failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
    }),
});
