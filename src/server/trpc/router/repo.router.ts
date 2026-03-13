import crypto from "node:crypto";
import { Status } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CreateRepoSchema, GitHubQuerySchema } from "@/shared/api/schemas/repo";

import { logger } from "@/server/logger/logger";
import { githubService } from "@/server/services/github.service";
import { repoService } from "@/server/services/repo.service";
import { FileClassifier } from "@/server/utils/file-classifier";
import { handlePrismaError, isOctokitError } from "@/server/utils/handle-error";
import { DocTypeSchema, RepoSchema, StatusSchema } from "@/generated/zod";

import { OpenApiErrorResponses, RepoFilterSchema } from "../shared";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const PublicRepoSchema = RepoSchema.extend({
  id: z.string(),
});

export const repoRouter = createTRPCRouter({
  analyze: protectedProcedure
    .meta({
      openapi: {
        errorResponses: OpenApiErrorResponses,
        method: "POST",
        path: "/repos/analyze",
        protect: true,
        summary: "Analyze your repository",
        tags: ["repositories"],
      },
    })
    .input(
      z.object({
        branch: z.string().optional(),
        docTypes: z.array(DocTypeSchema),
        files: z.array(z.string()),
        instructions: z.string().optional(),
        language: z.string(),
        repoId: z.uuid(),
      })
    )
    .output(z.object({ jobId: z.string(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId },
      });

      if (repo == null) throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });

      const analysis = await ctx.db.analysis.create({
        data: {
          repo: {
            connect: {
              publicId: input.repoId,
            },
          },
          status: "PENDING",
        },
      });
      const handle = await tasks.trigger(
        "analyze-repo",
        {
          analysisId: analysis.publicId,
          docTypes: input.docTypes,
          instructions: input.instructions,
          language: input.language,
          selectedBranch: input.branch,
          selectedFiles: input.files,
          userId: Number(ctx.session.user.id),
        },
        {
          concurrencyKey: `user-${ctx.session.user.id}`,
          idempotencyKey: `analysis-${analysis.publicId}`,
          ttl: "30m",
        }
      );

      await ctx.db.analysis.update({
        data: { jobId: handle.id },
        where: { publicId: analysis.publicId },
      });

      return { jobId: handle.id, status: "QUEUED" };
    }),
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
        owner: z.string().trim().min(1),
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

      const totalPages = Math.ceil(filteredCount / limit);

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

  getBranches: protectedProcedure
    .input(z.object({ name: z.string(), owner: z.string() }))
    .query(async ({ ctx, input }) => {
      let activeOctokit;
      let type;
      try {
        const context = await githubService.getClientContext(
          ctx.prisma,
          Number(ctx.session.user.id),
          input.owner
        );
        activeOctokit = context.octokit;
        type = context.type;
      } catch (err) {
        if (err instanceof Error && err.message.includes("No valid GitHub")) {
          activeOctokit = githubService.getSystemClient();
          type = "app";
        } else {
          throw err;
        }
      }

      try {
        const branches = await activeOctokit.paginate(activeOctokit.rest.repos.listBranches, {
          owner: input.owner,
          per_page: 100,
          repo: input.name,
        });
        return branches.map((b) => b.name);
      } catch (error) {
        if (
          type === "installation" &&
          isOctokitError(error) &&
          (error.status === 403 || error.status === 404)
        ) {
          const oauthAcc = await ctx.prisma.account.findFirst({
            select: { access_token: true },
            where: {
              access_token: { not: null },
              provider: "github",
              userId: Number(ctx.session.user.id),
            },
          });
          if (oauthAcc?.access_token != null) {
            const fallbackOctokit = githubService.getUserClient(oauthAcc.access_token);
            const branches = await fallbackOctokit.paginate(
              fallbackOctokit.rest.repos.listBranches,
              {
                owner: input.owner,
                per_page: 100,
                repo: input.name,
              }
            );
            return branches.map((b) => b.name);
          }
        }
        throw error;
      }
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
        name: z.string().trim().min(1),
        owner: z.string().trim().min(1),
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

  getDocument: protectedProcedure
    .input(
      z.object({
        repoId: z.string(),
        type: DocTypeSchema,
      })
    )
    .output(z.object({ content: z.string().nullable(), version: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const repo = await ctx.db.repo.findUnique({
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            select: { commitSha: true },
            take: 1,
            where: { status: "DONE" },
          },
        },
        where: { publicId: input.repoId },
      });

      if (repo?.analyses[0]?.commitSha == null) {
        return { content: null, version: null };
      }

      const version = repo.analyses[0].commitSha.substring(0, 7);

      const doc = await ctx.db.document.findUnique({
        select: { content: true },
        where: {
          repoId_version_type: {
            repoId: repo.id,
            type: input.type,
            version: version,
          },
        },
      });

      return {
        content: doc?.content ?? null,
        version,
      };
    }),

  getGithubInstallUrl: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);
    const state = crypto.randomBytes(32).toString("hex");

    await ctx.prisma.verificationToken.create({
      data: {
        expires: new Date(Date.now() + 10 * 60 * 1000),
        identifier: `github_install_${userId}`,
        token: state,
      },
    });

    return `https://github.com/apps/doxynix/installations/new?state=${state}`;
  }),

  getMyGithubRepos: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);

    const installations = await ctx.db.githubInstallation.findMany({
      orderBy: { createdAt: "asc" },
      where: { isSuspended: false, userId },
    });

    const oauthAccounts = await ctx.db.account.findMany({
      where: { access_token: { not: null }, provider: "github", userId },
    });

    if (installations.length === 0 && oauthAccounts.length === 0) {
      return { installationId: null, isConnected: false, items: [], manageUrl: null };
    }

    const mainInstall = installations.length > 0 ? installations[0] : undefined;

    const manageUrl = mainInstall?.htmlUrl ?? null;
    const installationId = mainInstall != null ? Number(mainInstall.id) : null;

    try {
      const repos = await githubService.getMyRepos(ctx.prisma, userId);
      return { installationId, isConnected: true, items: repos, manageUrl };
    } catch (error) {
      logger.error({ error, msg: "Dashboard fetch failed", userId });
      return { installationId, isConnected: true, items: [], manageUrl };
    }
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
      const tree = await githubService.getRepoTree(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.owner,
        input.name,
        input.branch
      );

      return tree.map((file) => [
        file.path,
        file.type === "blob" ? 1 : 0,
        file.sha.substring(0, 7),
        FileClassifier.getScore(file.path) > 40 ? 1 : 0,
      ]);
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

  saveInstallation: protectedProcedure
    .input(
      z.object({
        installationId: z.string().regex(/^\d+$/),
        state: z.string(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userIdNum = Number(ctx.session.user.id);
      const instIdBigInt = BigInt(input.installationId);
      const inputInstIdNum = Number(input.installationId);

      const consumed = await ctx.prisma.verificationToken.deleteMany({
        where: {
          expires: { gt: new Date() },
          identifier: `github_install_${userIdNum}`,
          token: input.state,
        },
      });

      if (consumed.count === 0) {
        logger.warn({ msg: "CSRF/Replay attack or expired state", userId: userIdNum });
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid, expired, or already used security state. Please try installing again.",
        });
      }

      const oauthAccount = await ctx.prisma.account.findFirst({
        select: { access_token: true },
        where: { access_token: { not: null }, provider: "github", userId: userIdNum },
      });

      if (oauthAccount?.access_token == null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must link your GitHub account before installing the app.",
        });
      }

      try {
        const userOctokit = githubService.getUserClient(oauthAccount.access_token);

        const userInstallations = await userOctokit.paginate(
          userOctokit.rest.apps.listInstallationsForAuthenticatedUser,
          { per_page: 100 }
        );

        const hasAccess = userInstallations.some((inst) => inst.id === inputInstIdNum);

        if (!hasAccess) {
          logger.warn({
            installationId: input.installationId,
            msg: "IDOR attempt: User tried to claim unowned installation",
            userId: userIdNum,
          });
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to claim this GitHub installation.",
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ error, msg: "GitHub API verification failed during saveInstallation" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify installation ownership via GitHub.",
        });
      }

      const installationInfo = await githubService.getInstallationInfo(inputInstIdNum);
      const account = installationInfo.account;
      const accountLogin = account !== null && "login" in account ? account.login : "Unknown";
      const accountAvatar = account !== null && "avatar_url" in account ? account.avatar_url : null;

      try {
        const updated = await ctx.db.githubInstallation.updateMany({
          data: {
            accountAvatar,
            accountLogin,
            htmlUrl: installationInfo.html_url,
            repositorySelection: installationInfo.repository_selection,
            userId: userIdNum,
          },
          where: {
            id: instIdBigInt,
            OR: [{ userId: null }, { userId: userIdNum }],
          },
        });

        if (updated.count === 0) {
          const created = await ctx.db.githubInstallation.createMany({
            data: [
              {
                accountAvatar,
                accountLogin,
                appId: installationInfo.app_id,
                htmlUrl: installationInfo.html_url,
                id: instIdBigInt,
                repositorySelection: installationInfo.repository_selection,
                targetId: BigInt(installationInfo.target_id),
                targetType: installationInfo.target_type || "Unknown",
                userId: userIdNum,
              },
            ],
            skipDuplicates: true,
          });

          if (created.count === 0) {
            const claimed = await ctx.db.githubInstallation.updateMany({
              data: {
                accountAvatar,
                accountLogin,
                repositorySelection: installationInfo.repository_selection,
                userId: userIdNum,
              },
              where: {
                id: instIdBigInt,
                OR: [{ userId: null }, { userId: userIdNum }],
              },
            });

            if (claimed.count === 0) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "This installation is already linked to another workspace.",
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logger.error({ error, msg: "Failed to securely claim installation" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to securely claim installation.",
        });
      }

      return { success: true };
    }),

  searchGithub: protectedProcedure.input(GitHubQuerySchema).query(async ({ ctx, input }) => {
    return await githubService.searchRepos(
      ctx.prisma,
      Number(ctx.session.user.id),
      input.query,
      10
    );
  }),
});
