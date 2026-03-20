import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { GitHubQuerySchema } from "@/shared/api/schemas/repo";

import { logger } from "@/server/logger/logger";
import { GitHubAuthRequiredError, githubService } from "@/server/services/github.service";
import { FileClassifier } from "@/server/utils/file-classifier";
import { isOctokitError } from "@/server/utils/handle-error";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const repoGithubRouter = createTRPCRouter({
  getBranches: protectedProcedure
    .input(z.object({ name: z.string(), owner: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await githubService.getRepoBranches(
          ctx.prisma,
          Number(ctx.session.user.id),
          input.owner,
          input.name
        );
      } catch (error) {
        if (error instanceof GitHubAuthRequiredError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Connect your GitHub account or install the app to access branches.",
          });
        }
        if (isOctokitError(error) && error.status === 404) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository or branch not found.",
          });
        }
        if (isOctokitError(error) && error.status === 403) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "GitHub denied access to repository branches.",
          });
        }
        throw error;
      }
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
      const userId = Number(ctx.session.user.id);
      const repo = await ctx.db.repo.findUnique({
        where: { publicId: input.repoId, userId },
      });

      if (!repo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
      }

      try {
        const fileData = await githubService.getFileContent(
          ctx.prisma,
          userId,
          repo.owner,
          repo.name,
          input.path,
          input.branch ?? repo.defaultBranch
        );

        return {
          content: fileData.content,
          meta: fileData.meta,
        };
      } catch (error) {
        logger.error({ error, msg: "Failed to fetch file content from GitHub", path: input.path });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not fetch file content from GitHub.",
        });
      }
    }),
  getGithubInstallUrl: protectedProcedure.query(async ({ ctx }) => {
    const userId = Number(ctx.session.user.id);
    const state = crypto.randomBytes(32).toString("hex");

    await ctx.prisma.$transaction([
      ctx.prisma.verificationToken.deleteMany({
        where: { identifier: `github_install_${userId}` },
      }),
      ctx.prisma.verificationToken.create({
        data: {
          expires: new Date(Date.now() + 10 * 60 * 1000),
          identifier: `github_install_${userId}`,
          token: state,
        },
      }),
    ]);

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
      return {
        installationId: null,
        isConnected: false,
        items: [],
        manageUrl: null,
        oauthStatus: "missing",
      };
    }

    const mainInstall = installations.length > 0 ? installations[0] : null;

    const manageUrl = mainInstall != null ? (mainInstall.htmlUrl ?? null) : null;
    const installationId = mainInstall !== null ? Number(mainInstall.id) : null;

    let oauthStatus: "valid" | "invalid" | "missing" = "missing";

    if (oauthAccounts.length > 0) {
      let hasUnauthorized = false;
      let hasValid = false;
      for (const oauthAccount of oauthAccounts) {
        if (oauthAccount.access_token == null) continue;
        try {
          const userOctokit = githubService.getUserClient(oauthAccount.access_token);
          await userOctokit.rest.users.getAuthenticated();
          hasValid = true;
          break;
        } catch (error) {
          if (isOctokitError(error) && error.status === 401) {
            hasUnauthorized = true;
          } else {
            logger.warn({ error, msg: "GitHub OAuth validation failed" });
          }
        }
      }
      if (hasValid) {
        oauthStatus = "valid";
      } else if (hasUnauthorized) {
        oauthStatus = "invalid";
      }
    }

    if (installationId == null && oauthStatus === "invalid") {
      return { installationId, isConnected: true, items: [], manageUrl, oauthStatus };
    }

    try {
      const repos = await githubService.getMyRepos(ctx.prisma, userId);
      return { installationId, isConnected: true, items: repos, manageUrl, oauthStatus };
    } catch (error) {
      logger.error({ error, msg: "Dashboard fetch failed", userId });
      return { installationId, isConnected: true, items: [], manageUrl, oauthStatus };
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
      let tree;
      try {
        tree = await githubService.getRepoTree(
          ctx.prisma,
          Number(ctx.session.user.id),
          input.owner,
          input.name,
          input.branch
        );
      } catch (error) {
        if (error instanceof GitHubAuthRequiredError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Connect your GitHub account or install the app to access repository files.",
          });
        }
        throw error;
      }

      return tree.map((file) => [
        file.path,
        file.type === "blob" ? 1 : 0,
        file.sha.substring(0, 7),
        FileClassifier.getScore(file.path) > 40 ? 1 : 0,
      ]);
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

      const consumedState = await ctx.prisma.verificationToken.deleteMany({
        where: {
          expires: { gt: new Date() },
          identifier: `github_install_${userIdNum}`,
          token: input.state,
        },
      });

      if (consumedState.count === 0) {
        logger.warn({ msg: "CSRF/Replay attack or expired state", userId: userIdNum });
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid, expired, or already used security state. Please try installing again.",
        });
      }

      const oauthAccounts = await ctx.prisma.account.findMany({
        select: { access_token: true },
        where: { access_token: { not: null }, provider: "github", userId: userIdNum },
      });

      if (oauthAccounts.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must link your GitHub account before installing the app.",
        });
      }

      let hasAccess = false;
      let verifiedAtLeastOneAccount = false;
      let hasUnauthorized = false;

      for (const oauthAccount of oauthAccounts) {
        if (oauthAccount.access_token == null) continue;
        try {
          const userOctokit = githubService.getUserClient(oauthAccount.access_token);
          const userInstallations = await userOctokit.paginate(
            userOctokit.rest.apps.listInstallationsForAuthenticatedUser,
            { per_page: 100 }
          );

          verifiedAtLeastOneAccount = true;

          if (userInstallations.some((inst) => inst.id === inputInstIdNum)) {
            hasAccess = true;
            break;
          }
        } catch (error) {
          if (isOctokitError(error) && (error.status === 401 || error.status === 403)) {
            hasUnauthorized = true;
          }
          logger.warn({ error, msg: "GitHub API verification failed for one OAuth account" });
        }
      }

      if (!verifiedAtLeastOneAccount) {
        if (hasUnauthorized) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "GitHub authorization expired. Please relink your GitHub account.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify installation ownership via GitHub.",
        });
      }

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

      const installationInfo = await githubService.getInstallationInfo(inputInstIdNum);
      const account = installationInfo.account;
      const accountLogin = account !== null && "login" in account ? account.login : "Unknown";
      const accountAvatar = account !== null && "avatar_url" in account ? account.avatar_url : null;

      try {
        const updated = await ctx.prisma.githubInstallation.updateMany({
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
          const created = await ctx.prisma.githubInstallation.createMany({
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
            const claimed = await ctx.prisma.githubInstallation.updateMany({
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
    try {
      return await githubService.searchRepos(
        ctx.prisma,
        Number(ctx.session.user.id),
        input.query,
        10
      );
    } catch (error) {
      if (error instanceof GitHubAuthRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub account or install the app to search repositories.",
        });
      }
      throw error;
    }
  }),
});
