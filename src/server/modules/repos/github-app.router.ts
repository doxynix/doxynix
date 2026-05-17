import z from "zod";

import { githubAppService } from "@/server/core/github/github-app.service";
import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

export const githubAppRouter = createTRPCRouter({
  getGithubInstallUrl: protectedProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    return githubAppService.getInstallUrl(ctx.prisma, Number(ctx.session.user.id));
  }),

  getMyGithubRepos: protectedProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    return githubAppService.getMyRepos(ctx.db, ctx.prisma, Number(ctx.session.user.id));
  }),

  saveInstallation: protectedProcedure
    .input(
      z.object({
        installationId: z.string().regex(/^\d+$/),
        state: z.string().trim().min(1),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return githubAppService.saveInstallation(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.installationId,
        input.state
      );
    }),
});
