import {
  CreateRepoSchema,
  CursorMetaSchema,
  PaginationMetaSchema,
  PublicRepoSchema,
  StatusSchema,
} from "@doxynix/shared";
import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { repoMapper } from "./repo.mapper";
import { RepoFilterSchema, RepoSlimFilterSchema } from "./repo.schemas";
import { repoService } from "./repo.service";

const RepoWithMetricsSchema = z.object({
  ...PublicRepoSchema.shape,
  complexityScore: z.number().nullish(),
  healthScore: z.number().nullish(),
  languageColor: z.string(),
  lastAnalysisDate: z.date().nullish(),
  onboardingScore: z.number().nullish(),
  securityScore: z.number().nullish(),
  status: StatusSchema,
  techDebtScore: z.number().nullish(),
});

export const repoRouter = createTRPCRouter({
  create: protectedProcedure
    .input(CreateRepoSchema)
    .output(
      z.object({
        repo: PublicRepoSchema,
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newRepo = await repoService.createRepo(ctx.db, ctx.session.user.id, input.url);

      return {
        repo: { ...repoMapper.toPublicFields(newRepo), status: "NEW" },
        success: true,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return repoService.delete(ctx.db, input.id, ctx.session.user.id);
    }),

  deleteAll: protectedProcedure
    .input(z.object({}).optional())
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return repoService.deleteAll(ctx.db, ctx.session.user.id);
    }),

  deleteByOwner: protectedProcedure
    .input(
      z.object({
        owner: z.string().trim().min(1).max(39),
      }),
    )
    .output(
      z.object({
        count: z.number(),
        success: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return repoService.deleteByOwner(ctx.db, input.owner, ctx.session.user.id);
    }),

  getAll: protectedProcedure
    .input(RepoFilterSchema)
    .output(
      z.object({
        items: z.array(RepoWithMetricsSchema),
        meta: PaginationMetaSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return repoService.getAll(ctx.db, input, ctx.session.user.id);
    }),

  getByName: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        owner: z.string().trim().min(1).max(39),
      }),
    )
    .output(z.nullable(PublicRepoSchema))
    .query(async ({ ctx, input }) => {
      return repoService.getByName(ctx.db, input.owner, input.name);
    }),

  getByOwner: protectedProcedure
    .input(
      z.object({
        owner: z.string().trim().min(1).max(39),
      }),
    )
    .output(z.nullable(PublicRepoSchema))
    .query(async ({ ctx, input }) => {
      return repoService.getByOwner(ctx.db, input.owner);
    }),

  getSlim: protectedProcedure
    .input(RepoSlimFilterSchema)
    .output(
      z.object({
        items: z.array(
          z.object({
            avatar: z.string().nullable(),
            id: z.uuid(),
            name: z.string(),
            owner: z.string(),
          }),
        ),
        meta: CursorMetaSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      return repoService.getSlim(ctx.db, input, ctx.session.user.id);
    }),
});
