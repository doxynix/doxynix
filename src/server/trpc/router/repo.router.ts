import { DocType, Status } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { CreateRepoSchema, GitHubQuerySchema } from "@/shared/api/schemas/repo";

import { RepoSchema } from "@/generated/zod";
import { githubService } from "@/server/services/github.service";
import { repoService } from "@/server/services/repo.service";
import { OpenApiErrorResponses, RepoFilterSchema } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { FileClassifier } from "@/server/utils/file-classifier";
import { handlePrismaError } from "@/server/utils/handle-prisma-error";

export const PublicRepoSchema = RepoSchema.extend({
  id: z.string(),
}).omit({ publicId: true, userId: true });

export const repoRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/repos",
        tags: ["repositories"],
        summary: "Add a new repository",
        description:
          "Registers a new repository in the system for analysis and tracking. The repository must be accessible to the authenticated user.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(CreateRepoSchema)
    .output(
      z.object({
        success: z.boolean(),
        repo: PublicRepoSchema,
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newRepo = await repoService.createRepo(ctx.db, Number(ctx.session.user.id), input.url);

      return {
        success: true,
        repo: { ...newRepo, id: newRepo.publicId },
        message: "Repository added",
      };
    }),
  searchGithub: protectedProcedure.input(GitHubQuerySchema).query(async ({ ctx, input }) => {
    return await githubService.searchRepos(ctx.db, Number(ctx.session.user.id), input.query, 10);
  }),
  getMyGithubRepos: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.db.account.findFirst({
      where: {
        userId: Number(ctx.session.user.id),
        provider: "github",
      },
    });

    if (account === null) {
      return {
        isConnected: false,
        items: [],
      };
    }

    const repos = await githubService.getMyRepos(ctx.prisma, Number(ctx.session.user.id));

    return {
      isConnected: true,
      items: repos,
    };
  }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/repos/{id}",
        tags: ["repositories"],
        summary: "Remove a repository",
        description:
          "Deletes the repository from the system along with its associated analytics and history. This does not affect the original GitHub repository.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.repo.delete({
          where: { publicId: input.id },
        });

        return { success: true, message: "Repository deleted" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Repository not found" });
      }
    }),

  getByName: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/repos/{owner}/{name}",
        tags: ["repositories"],
        summary: "Get repository by owner and name",
        description:
          "Retrieves detailed information about a repository identified by its GitHub owner and name, including its latest analysis state.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      z.object({
        owner: z.string().trim().min(1),
        name: z.string().trim().min(1),
      })
    )
    .output(
      PublicRepoSchema.extend({ status: z.enum(Status).nullish(), message: z.string() }).nullable()
    )
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.repo.findFirst({
        where: {
          owner: { equals: input.owner, mode: "insensitive" },
          name: { equals: input.name, mode: "insensitive" },
        },
        include: {
          analyses: { take: 1, orderBy: { createdAt: "desc" } },
        },
      });

      if (repo === null) return null;

      return {
        ...repo,
        id: repo.publicId,
        status: repo.analyses[0]?.status ?? Status.NEW,
        message: "Repository found",
      };
    }),

  deleteByOwner: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/repos/owner/{owner}",
        tags: ["repositories"],
        summary: "Delete repositories by owner",
        description:
          "Deletes all repositories belonging to the specified GitHub owner from the system. This only removes stored data and does not affect the original GitHub repositories.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      z.object({
        owner: z.string().trim().min(1),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        count: z.number(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.repo.deleteMany({
        where: {
          owner: { equals: input.owner, mode: "insensitive" },
          userId: Number(ctx.session.user.id),
        },
      });

      return {
        success: true,
        count: result.count,
        message: `Deleted ${result.count} repositories for ${input.owner}`,
      };
    }),

  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/repos",
        tags: ["repositories"],
        summary: "Retrieve repositories with optional filters",
        description:
          "Returns a paginated list of repositories. Supports filtering by status, search queries, ownership, and sorting options.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(RepoFilterSchema)
    .output(
      z.object({
        items: z.array(
          PublicRepoSchema.extend({
            status: z.enum(Status),
            lastAnalysisDate: z.date().nullish(),
          })
        ),
        meta: z.object({
          totalCount: z.number().int(),
          filteredCount: z.number().int(),
          totalPages: z.number().int(),
          currentPage: z.number().int(),
          pageSize: z.number().int(),
          nextCursor: z.number().int().optional(),
          searchQuery: z.string().optional(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, search, cursor, status, visibility, sortBy, sortOrder, owner } = input;
      const page = Math.min(Math.max(1, cursor ?? 1), 1000000);

      const where = repoService.buildWhereClause({ search, visibility, status, owner });

      const contextWhere: typeof where =
        owner !== undefined ? { owner: { equals: owner, mode: "insensitive" } } : {};

      const [items, totalCount, filteredCount] = await Promise.all([
        ctx.db.repo.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            analyses: { take: 1, orderBy: { createdAt: "desc" } },
          },
        }),
        ctx.db.repo.count({ where: contextWhere }),
        ctx.db.repo.count({ where }),
      ]);

      const totalPages = Math.ceil(filteredCount / limit);

      return {
        items: items.map((repo) => ({
          ...repo,
          id: repo.publicId,
          status: repo.analyses[0]?.status ?? Status.NEW,
          lastAnalysisDate: repo.analyses[0]?.createdAt ?? null,
        })),
        meta: {
          totalCount,
          filteredCount,
          totalPages,
          currentPage: page,
          pageSize: limit,
          nextCursor: page < totalPages ? page + 1 : undefined,
          searchQuery: search,
        },
      };
    }),
  deleteAll: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/repos",
        tags: ["repositories"],
        summary: "Remove all repositories",
        description:
          "Deletes the all repositories from the system along with its associated analytics and history. This does not affect the original GitHub repository.",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.void())
    .output(z.object({ success: z.boolean(), message: z.string() }))
    .mutation(async ({ ctx }) => {
      try {
        const deletedRepoCount = await ctx.db.repo.deleteMany();
        if (deletedRepoCount.count === 0) {
          return { success: false, message: "No repositories found" };
        }

        return { success: true, message: "All repositories have been deleted" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Repositories not found" });
      }
    }),
  getRepoFiles: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        name: z.string(),
        branch: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tree = await githubService.getRepoTree(
        ctx.db,
        Number(ctx.session.user.id),
        input.owner,
        input.name,
        input.branch
      );

      return tree.map((file) => ({
        ...file,
        recommended: FileClassifier.getScore(file.path) > 40,
      }));
    }),
  analyze: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/repos/analyze",
        tags: ["repositories"],
        summary: "Analyze your repository",
        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(
      z.object({
        repoId: z.uuid(),
        files: z.array(z.string()),
        instructions: z.string().optional(),
        docTypes: z.array(z.enum(DocType)),
        language: z.string(),
      })
    )
    .output(z.object({ status: z.string(), jobId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo === null)
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });

      const newAnalysisId = uuidv7();

      await ctx.db.analysis.create({
        data: {
          publicId: newAnalysisId,
          status: "PENDING",
          repo: {
            connect: {
              publicId: input.repoId,
            },
          },
        },
      });

      const handle = await tasks.trigger(
        "analyze-repo",
        {
          analysisId: newAnalysisId,
          userId: Number(ctx.session.user.id),
          selectedFiles: input.files,
          instructions: input.instructions,
          docTypes: input.docTypes,
          language: input.language,
        },
        {
          concurrencyKey: `user-${ctx.session.user.id}`,
          idempotencyKey: `analysis-${newAnalysisId}`,
          ttl: "30m",
        }
      );

      await ctx.db.analysis.update({
        where: { publicId: newAnalysisId },
        data: { jobId: handle.id },
      });

      return { status: "QUEUED", jobId: newAnalysisId };
    }),
});
