import { z } from "zod";

import { CreateRepoSchema } from "@/shared/api/schemas/repo";

import { repoService } from "@/server/entities/repo/api/repo.service";
import { PaginationMetaSchema } from "@/server/shared/lib/pagination";
import { RepoSchema, StatusSchema } from "@/generated/zod";

import { OpenApiErrorResponses, RepoFilterSchema } from "../contracts";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const PublicRepoSchema = RepoSchema.extend({
  id: z.string(),
});

export const repoRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        description:
          "Registers a new repository in the system for analysis and tracking. The repository must be accessible to the authenticated user.",
        errorResponses: OpenApiErrorResponses,
        method: "POST",
        path: "/repos",
        protect: true,
        summary: "Add a new repository",
        tags: ["repositories"],
      },
    })
    .input(CreateRepoSchema)
    .output(
      z.object({
        message: z.string(),
        repo: PublicRepoSchema,
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newRepo = await repoService.createRepo(ctx.db, Number(ctx.session.user.id), input.url);

      return {
        message: "Repository added",
        repo: { ...newRepo, id: newRepo.publicId },
        success: true,
      };
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        description:
          "Deletes the repository from the system along with its associated analytics and history. This does not affect the original GitHub repository.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/repos/{id}",
        protect: true,
        summary: "Remove a repository",
        tags: ["repositories"],
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return repoService.delete(ctx.db, input.id);
    }),

  deleteAll: protectedProcedure
    .meta({
      openapi: {
        description:
          "Deletes the all repositories from the system along with its associated analytics and history. This does not affect the original GitHub repository.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/repos",
        protect: true,
        summary: "Remove all repositories",
        tags: ["repositories"],
      },
    })
    .input(z.void())
    .output(z.object({ message: z.string(), success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      return repoService.deleteAll(ctx.db);
    }),

  deleteByOwner: protectedProcedure
    .meta({
      openapi: {
        description:
          "Deletes all repositories belonging to the specified GitHub owner from the system. This only removes stored data and does not affect the original GitHub repositories.",
        errorResponses: OpenApiErrorResponses,
        method: "DELETE",
        path: "/repos/owner/{owner}",
        protect: true,
        summary: "Delete repositories by owner",
        tags: ["repositories"],
      },
    })
    .input(
      z.object({
        owner: z.string().trim().min(1).max(39),
      })
    )
    .output(
      z.object({
        count: z.number(),
        message: z.string(),
        success: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return repoService.deleteByOwner(ctx.db, input.owner);
    }),

  getAll: protectedProcedure
    .meta({
      openapi: {
        description:
          "Returns a paginated list of repositories. Supports filtering by status, search queries, ownership, and sorting options.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/repos",
        protect: true,
        summary: "Retrieve repositories with optional filters",
        tags: ["repositories"],
      },
    })
    .input(RepoFilterSchema)
    .output(
      z.object({
        items: z.array(
          PublicRepoSchema.extend({
            complexityScore: z.number().nullish(),
            healthScore: z.number().nullish(),
            lastAnalysisDate: z.date().nullish(),
            onboardingScore: z.number().nullish(),
            securityScore: z.number().nullish(),
            status: StatusSchema,
            techDebtScore: z.number().nullish(),
          })
        ),
        meta: PaginationMetaSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      return repoService.getAll(ctx.db, input);
    }),

  getByName: protectedProcedure
    .meta({
      openapi: {
        description:
          "Retrieves detailed information about a repository identified by its GitHub owner and name, including its latest analysis state.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/repos/{owner}/{name}",
        protect: true,
        summary: "Get repository by owner and name",
        tags: ["repositories"],
      },
    })
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        owner: z.string().trim().min(1).max(39),
      })
    )
    .output(PublicRepoSchema.extend({ message: z.string(), status: StatusSchema }).nullable())
    .query(async ({ ctx, input }) => {
      return repoService.getByName(ctx.db, input.owner, input.name);
    }),

  getByOwner: protectedProcedure
    .meta({
      openapi: {
        description:
          "Retrieves detailed information about a repository identified by its GitHub owner, including its latest analysis state.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/repos/{owner}",
        protect: true,
        summary: "Get repository by owner",
        tags: ["repositories"],
      },
    })
    .input(
      z.object({
        owner: z.string().trim().min(1).max(39),
      })
    )
    .output(PublicRepoSchema.extend({ message: z.string() }).nullable())
    .query(async ({ ctx, input }) => {
      return repoService.getByOwner(ctx.db, input.owner);
    }),

  getSlim: protectedProcedure
    .meta({
      openapi: {
        description: "Get a lightweight list of repositories for filters and selectors.",
        errorResponses: OpenApiErrorResponses,
        method: "GET",
        path: "/repos/slim",
        protect: true,
        summary: "Retrieve slim repositories list",
        tags: ["repositories"],
      },
    })
    .input(z.object({ limit: z.coerce.number().int().min(1).max(100000).optional() }))
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          owner: z.string(),
        })
      )
    )
    .query(async ({ ctx, input }) => {
      return repoService.getSlim(ctx.db, input.limit);
    }),
});
