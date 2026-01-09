import { Status } from "@prisma/client";
import { z } from "zod";

import { RepoSchema } from "@/generated/zod";
import { repoService } from "@/server/services/repo.service";
import { OpenApiErrorResponses, RepoFilterSchema } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { handlePrismaError } from "@/server/utils/handlePrismaError";

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
    .input(
      z.object({
        url: z.string().trim().min(1, "Ссылка не может быть пустой"),
      })
    )
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
        message: "Репозиторий добавлен",
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

        return { success: true, message: "Репозиторий удален" };
      } catch (error) {
        handlePrismaError(error, { notFound: "Репозиторий не найден" });
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
    .output(PublicRepoSchema.extend({ status: z.enum(Status).nullish() }).nullable())
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
      const { limit, search, cursor, status, visibility, sortBy, sortOrder } = input;
      const page = Math.min(Math.max(1, cursor ?? 1), 1000000);

      const where = repoService.buildWhereClause({ search, visibility, status });

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
        ctx.db.repo.count(),
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
});
