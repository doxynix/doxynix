import { TRPCError } from "@trpc/server";

import { FileClassifier } from "@/server/engine/core/file-classifier";
import type { DbClient, PrismaClientExtended } from "@/server/infrastructure/db";
import { logger } from "@/server/infrastructure/logger";
import { GitHubAuthRequiredError, githubService } from "@/server/services/github.service";
import { isOctokitError } from "@/server/utils/handle-error";

export const githubBrowseService = {
  async getBranches(prisma: PrismaClientExtended, userId: number, owner: string, name: string) {
    try {
      return await githubService.getRepoBranches(prisma, userId, owner, name);
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
  },

  async getFileContent(
    db: DbClient,
    prisma: PrismaClientExtended,
    userId: number,
    repoId: string,
    path: string,
    branch?: string
  ) {
    const repo = await db.repo.findUnique({
      where: { publicId: repoId, userId },
    });

    if (repo == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
    }

    try {
      const fileData = await githubService.getFileContent(
        prisma,
        userId,
        repo.owner,
        repo.name,
        path,
        branch ?? repo.defaultBranch
      );

      return {
        content: fileData.content,
        meta: fileData.meta,
      };
    } catch (error) {
      logger.error({ error, msg: "Failed to fetch file content from GitHub", path });
      if (error instanceof GitHubAuthRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub account or install the app to access this file.",
        });
      }
      if (isOctokitError(error) && error.status === 404) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File or branch not found.",
        });
      }
      if (isOctokitError(error) && error.status === 403) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "GitHub denied access to this file.",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch file content from GitHub.",
      });
    }
  },

  async getRepoFiles(
    prisma: PrismaClientExtended,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    let tree;
    try {
      tree = await githubService.getRepoTree(prisma, userId, owner, name, branch);
    } catch (error) {
      if (error instanceof GitHubAuthRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub account or install the app to access repository files.",
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
          message: "GitHub denied access to repository files.",
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
  },

  async searchGithub(prisma: PrismaClientExtended, userId: number, query: string) {
    try {
      return await githubService.searchRepos(prisma, userId, query, 10);
    } catch (error) {
      if (error instanceof GitHubAuthRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub account or install the app to search repositories.",
        });
      }
      throw error;
    }
  },
};
