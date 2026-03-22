import { Status } from "@prisma/client";
import { z } from "zod";

import { CreateRepoSchema } from "@/shared/api/schemas/repo";

import { repoService } from "@/server/services/repo.service";
import { handlePrismaError } from "@/server/utils/handle-error";
import { RepoSchema, StatusSchema } from "@/generated/zod";

import { OpenApiErrorResponses, RepoFilterSchema } from "../shared";
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
      const newRepo = await repoService.createRepo(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.url
      );

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
      try {
        await ctx.db.repo.delete({
          where: { publicId: input.id },
        });

        return { message: "Repository deleted", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Repository not found" });
      }
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
      try {
        const deletedRepoCount = await ctx.db.repo.deleteMany();
        if (deletedRepoCount.count === 0) {
          return { message: "No repositories found", success: false };
        }

        return { message: "All repositories have been deleted", success: true };
      } catch (error) {
        handlePrismaError(error, { notFound: "Repositories not found" });
      }
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
      const result = await ctx.db.repo.deleteMany({
        where: {
          owner: { equals: input.owner, mode: "insensitive" },
        },
      });

      return {
        count: result.count,
        message: `Deleted ${result.count} repositories for ${input.owner}`,
        success: true,
      };
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
        meta: z.object({
          currentPage: z.number().int(),
          filteredCount: z.number().int(),
          nextCursor: z.number().int().optional(),
          pageSize: z.number().int(),
          searchQuery: z.string().optional(),
          totalCount: z.number().int(),
          totalPages: z.number().int(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, owner, search, sortBy, sortOrder, status, visibility } = input;
      const page = Math.min(Math.max(1, cursor ?? 1), 1000000);

      const where = repoService.buildWhereClause({ owner, search, status, visibility });

      const contextWhere: typeof where =
        owner == null ? {} : { owner: { equals: owner, mode: "insensitive" } };

      const [items, totalCount, filteredCount] = await Promise.all([
        ctx.db.repo.findMany({
          include: {
            analyses: {
              orderBy: { createdAt: "desc" },
              select: {
                complexityScore: true,
                createdAt: true,
                onboardingScore: true,
                score: true,
                securityScore: true,
                status: true,
                techDebtScore: true,
              },
              take: 1,
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          where,
        }),
        ctx.db.repo.count({ where: contextWhere }),
        ctx.db.repo.count({ where }),
      ]);

      const totalPages = Math.max(1, Math.ceil(filteredCount / limit));

      return {
        items: items.map((repo) => ({
          ...repo,
          complexityScore: repo.analyses[0]?.complexityScore ?? null,
          healthScore: repo.analyses[0]?.score ?? null,
          id: repo.publicId,
          lastAnalysisDate: repo.analyses[0]?.createdAt ?? null,
          onboardingScore: repo.analyses[0]?.onboardingScore ?? null,
          securityScore: repo.analyses[0]?.securityScore ?? null,
          status: repo.analyses[0]?.status ?? Status.NEW,
          techDebtScore: repo.analyses[0]?.techDebtScore ?? null,
        })),
        meta: {
          currentPage: page,
          filteredCount,
          nextCursor: page < totalPages ? page + 1 : undefined,
          pageSize: limit,
          searchQuery: search,
          totalCount,
          totalPages,
        },
      };
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
      const repo = await ctx.db.repo.findFirst({
        include: {
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        where: {
          name: { equals: input.name, mode: "insensitive" },
          owner: { equals: input.owner, mode: "insensitive" },
        },
      });

      if (repo == null) return null;

      return {
        ...repo,
        id: repo.publicId,
        message: "Repository found",
        status: repo.analyses[0]?.status ?? Status.NEW,
      };
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
      const repo = await ctx.db.repo.findFirst({
        where: {
          owner: { equals: input.owner, mode: "insensitive" },
        },
      });

      if (repo == null) return null;

      return {
        ...repo,
        id: repo.publicId,
        message: "Owner found",
      };
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
    .input(z.object({ limit: z.coerce.number().min(1).max(100000).optional() }))
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
      const repos = await ctx.db.repo.findMany({
        orderBy: { name: "asc" },
        select: { name: true, owner: true, publicId: true },
        take: input.limit,
      });

      return repos.map((r) => ({ id: r.publicId, name: r.name, owner: r.owner }));
    }),
});
