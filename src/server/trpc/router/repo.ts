import { Prisma, Status, Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { RepoSchema } from "@/generated/zod";
import { githubService } from "@/server/services/github.service";
import { OpenApiErrorResponses, RepoFilterSchema } from "@/server/trpc/shared";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";

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
          "Creates a new repository entry for the authenticated user. Requires repository owner and name information. Only accessible to logged-in users.",

        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ url: z.string().min(1) }))
    .output(
      z.object({
        success: z.boolean(),
        repo: PublicRepoSchema,
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let repoInfo;
      try {
        repoInfo = githubService.parseUrl(input.url);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Некорректная ссылка. Используйте формат 'owner/name' или 'https://github.com/...",
        });
      }

      const { owner, name } = repoInfo;
      const userId = Number(ctx.session.user.id);

      const existing = await ctx.prisma.repo.findFirst({
        where: {
          userId,
          owner: { equals: owner, mode: "insensitive" },
          name: { equals: name, mode: "insensitive" },
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Вы уже добавили этот репозиторий" });
      }

      let githubData;
      try {
        githubData = await githubService.getRepoInfo(userId, owner, name, ctx.prisma);
        const existingRepo = await ctx.prisma.repo.findUnique({
          where: {
            githubId_userId: {
              githubId: githubData.id,
              userId: userId,
            },
          },
        });
        if (existingRepo) {
          if (
            existingRepo.name !== githubData.name ||
            existingRepo.owner !== githubData.owner.login
          ) {
            await ctx.prisma.repo.update({
              where: { id: existingRepo.id },
              data: { name: githubData.name, owner: githubData.owner.login },
            });
          }
          throw new TRPCError({ code: "CONFLICT", message: "Вы уже добавили этот репозиторий" });
        }
      } catch (error) {
        console.error("GitHub Error:", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Репозиторий не найден на GitHub",
        });
      }

      const newRepo = await ctx.prisma.repo.create({
        data: {
          githubId: githubData.id,
          owner: githubData.owner.login,
          name: githubData.name,
          description: githubData.description,
          url: githubData.html_url,
          language: githubData.language,
          license: githubData.license?.name,
          topics: githubData.topics ?? [],
          stars: githubData.stargazers_count,
          forks: githubData.forks_count,
          openIssues: githubData.open_issues_count,
          size: githubData.size,
          pushedAt: new Date(githubData.pushed_at),
          githubCreatedAt: new Date(githubData.created_at),
          defaultBranch: githubData.default_branch,
          ownerAvatarUrl: githubData.owner.avatar_url,
          visibility: githubData.private ? Visibility.PRIVATE : Visibility.PUBLIC,
          userId,
          analyses: {
            create: {
              status: "NEW",
              metricsJson: {},
              commitSha: githubData.default_branch,
            },
          },
        },
      });

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
          "Deletes a repository specified by its ID. Only the owner of the repository or an authorized user can perform this operation.",

        protect: true,
        errorResponses: OpenApiErrorResponses,
      },
    })
    .input(z.object({ id: z.uuid() }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.repo.deleteMany({
        where: {
          publicId: input.id,
          userId: Number(ctx.session.user.id),
        },
      });

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Репозиторий не найден или вы не владелец",
        });
      }

      return { success: true, message: "Репозиторий удален" };
    }),

  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/repos",
        tags: ["repositories"],
        summary: "Retrieve repositories with optional filters",
        description:
          "Fetches a list of repositories belonging to the authenticated user. Supports filtering, sorting, and searching by repository name, visibility, or other criteria.",

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
      const userId = Number(ctx.session.user.id);
      const { limit, search, cursor, status, visibility, sortBy, sortOrder } = input;

      const page = Math.min(Math.max(1, cursor ?? 1), 1000000);

      const where: Prisma.RepoWhereInput = {
        userId,
        ...(visibility && { visibility }),

        ...(search != null && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { owner: { contains: search, mode: "insensitive" } },
          ],
        }),

        ...(status && {
          analyses: {
            some: {
              status: status,
            },
          },
        }),
      };

      const [items, totalCount, filteredCount] = await Promise.all([
        ctx.prisma.repo.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            analyses: {
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        ctx.prisma.repo.count({ where: { userId } }),
        ctx.prisma.repo.count({ where }),
      ]);

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
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          pageSize: limit,
          nextCursor: page < Math.ceil(totalCount / limit) ? page + 1 : undefined,
          searchQuery: search,
        },
      };
    }),
});
