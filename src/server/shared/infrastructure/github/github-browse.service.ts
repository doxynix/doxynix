import { TRPCError } from "@trpc/server";

import { getFileScore } from "@/server/shared/engine/core/file-classifier";
import type { DbClient, PrismaClientExtended } from "@/server/shared/infrastructure/db";
import {
  getFileContent,
  getRepoBranches,
  getRepoTree,
  searchRepos,
} from "@/server/shared/infrastructure/github/github-api";
import { GitHubAuthRequiredError } from "@/server/shared/infrastructure/github/github-provider";
import { logger } from "@/server/shared/infrastructure/logger";
import { isOctokitError } from "@/server/shared/lib/handle-error";

function throwBrowseAccessError(params: {
  authMessage: string;
  forbiddenMessage: string;
  notFoundMessage: string;
  sourceError: unknown;
}) {
  if (params.sourceError instanceof GitHubAuthRequiredError) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: params.authMessage,
    });
  }
  if (isOctokitError(params.sourceError) && params.sourceError.status === 404) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: params.notFoundMessage,
    });
  }
  if (isOctokitError(params.sourceError) && params.sourceError.status === 403) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: params.forbiddenMessage,
    });
  }
  throw params.sourceError;
}

export const githubBrowseService = {
  async getBranches(prisma: PrismaClientExtended, userId: number, owner: string, name: string) {
    try {
      return await getRepoBranches(prisma, userId, owner, name);
    } catch (error) {
      throwBrowseAccessError({
        authMessage: "Connect your GitHub account or install the app to access branches.",
        forbiddenMessage: "GitHub denied access to repository branches.",
        notFoundMessage: "Repository or branch not found.",
        sourceError: error,
      });
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
      const fileData = await getFileContent(
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
      if (
        error instanceof GitHubAuthRequiredError ||
        (isOctokitError(error) && (error.status === 403 || error.status === 404))
      ) {
        throwBrowseAccessError({
          authMessage: "Connect your GitHub account or install the app to access this file.",
          forbiddenMessage: "GitHub denied access to this file.",
          notFoundMessage: "File or branch not found.",
          sourceError: error,
        });
      }

      if (!isOctokitError(error)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not fetch file content from GitHub.",
        });
      }
      throw error;
    }
  },

  async getRepoFiles(
    prisma: PrismaClientExtended,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    let tree: Awaited<ReturnType<typeof getRepoTree>> | null = null;
    try {
      tree = await getRepoTree(prisma, userId, owner, name, branch);
    } catch (error) {
      throwBrowseAccessError({
        authMessage: "Connect your GitHub account or install the app to access repository files.",
        forbiddenMessage: "GitHub denied access to repository files.",
        notFoundMessage: "Repository or branch not found.",
        sourceError: error,
      });
    }

    if (tree == null) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch repository files from GitHub.",
      });
    }

    return tree.map((file) => [
      file.path,
      file.type === "blob" ? 1 : 0,
      file.sha.substring(0, 7),
      getFileScore(file.path) > 40 ? 1 : 0,
    ]);
  },

  async searchGithub(prisma: PrismaClientExtended, userId: number, query: string) {
    try {
      return await searchRepos(prisma, userId, query, 10);
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
