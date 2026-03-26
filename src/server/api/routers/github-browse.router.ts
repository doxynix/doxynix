import { z } from "zod";

import { GitHubQuerySchema } from "@/shared/api/schemas/repo";

import { githubBrowseService } from "@/server/services/github-browse.service";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const githubBrowseRouter = createTRPCRouter({
  getBranches: protectedProcedure
    .input(z.object({ name: z.string(), owner: z.string() }))
    .query(async ({ ctx, input }) => {
      return githubBrowseService.getBranches(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.owner,
        input.name
      );
    }),

  getFileContent: protectedProcedure
    .input(
      z.object({
        branch: z.string().optional(),
        path: z.string(),
        repoId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return githubBrowseService.getFileContent(
        ctx.db,
        ctx.prisma,
        Number(ctx.session.user.id),
        input.repoId,
        input.path,
        input.branch
      );
    }),

  getRepoFiles: protectedProcedure
    .input(
      z.object({
        branch: z.string().optional(),
        name: z.string(),
        owner: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return githubBrowseService.getRepoFiles(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.owner,
        input.name,
        input.branch
      );
    }),

  searchGithub: protectedProcedure.input(GitHubQuerySchema).query(async ({ ctx, input }) => {
    return githubBrowseService.searchGithub(ctx.prisma, Number(ctx.session.user.id), input.query);
  }),
});
