import * as z from "zod";

import { createTRPCRouter, workspaceProcedure } from "@/server/core/trpc/init";
import { githubAppService } from "@/server/modules/repos/github-app.service";

export const githubAppRouter = createTRPCRouter({
  getGithubInstallUrl: workspaceProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    return githubAppService.getInstallUrl(ctx.prisma, ctx.session.user.id, ctx.workspace.id);
  }),

  getMyGithubRepos: workspaceProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    return githubAppService.getMyRepos(ctx.db, ctx.prisma, ctx.session.user.id, ctx.workspace.id);
  }),

  saveInstallation: workspaceProcedure
    .input(
      z.object({
        installationId: z.string().regex(/^\d+$/),
        state: z.string().trim().min(1),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return githubAppService.saveInstallation(
        ctx.prisma,
        ctx.session.user.id,
        input.installationId,
        input.state,
      );
    }),
});
