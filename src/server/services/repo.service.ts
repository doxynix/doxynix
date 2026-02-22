import { Status, Visibility, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/shared/api/db/db";

import { handlePrismaError } from "@/server/utils/handle-prisma-error";
import { githubService } from "./github.service";

type OctokitError = {
  message: string;
  status: number;
};

function isOctokitError(error: unknown): error is OctokitError {
  return (
    typeof error === "object" &&
    error != null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  );
}

export const repoService = {
  buildWhereClause(filters: {
    owner?: string;
    search?: string;
    status?: Status;
    visibility?: Visibility;
  }): Prisma.RepoWhereInput {
    const { owner, search, status, visibility } = filters;
    const searchTerms = search != null ? search.trim().split(/\s+/) : [];

    const statusFilter: Prisma.RepoWhereInput =
      status != null
        ? status === Status.NEW
          ? { OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }] }
          : { analyses: { some: { status } } }
        : {};

    const visibilityFilter = visibility != null ? { visibility } : {};

    const ownerFilter: Prisma.RepoWhereInput =
      owner != null ? { owner: { equals: owner, mode: "insensitive" } } : {};

    const searchFilter: Prisma.RepoWhereInput =
      searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { owner: { contains: term, mode: "insensitive" } },
                { description: { contains: term, mode: "insensitive" } },
              ],
            })),
          }
        : {};

    return {
      ...visibilityFilter,
      ...statusFilter,
      ...ownerFilter,
      ...searchFilter,
    };
  },

  async createRepo(db: DbClient, userId: number, url: string) {
    let repoInfo;
    try {
      repoInfo = githubService.parseUrl(url);
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid URL. Use 'owner/repo' format or 'https://github.com/...",
      });
    }

    const { name, owner } = repoInfo;

    let githubData;
    try {
      githubData = await githubService.getRepoInfo(db, userId, owner, name);
    } catch (error) {
      if (isOctokitError(error)) {
        if (error.status === 401) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub token expired",
          });
        }
        if (error.status === 404)
          throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found on GitHub" });
        if (error.status === 403)
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "GitHub API limit exceeded" });
      }
      throw error;
    }

    try {
      return await db.repo.create({
        data: {
          defaultBranch: githubData.default_branch,
          description: githubData.description,
          forks: githubData.forks_count,
          githubCreatedAt: new Date(githubData.created_at),
          githubId: githubData.id,
          language: githubData.language,
          license: githubData.license?.name,
          name: githubData.name,
          openIssues: githubData.open_issues_count,
          owner: githubData.owner.login,
          ownerAvatarUrl: githubData.owner.avatar_url,
          pushedAt: new Date(githubData.pushed_at),
          size: githubData.size,
          stars: githubData.stargazers_count,
          topics: githubData.topics ?? [],
          url: githubData.html_url,
          userId,
          visibility: githubData.private ? Visibility.PRIVATE : Visibility.PUBLIC,
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        defaultConflict: "You have already added this repository",
        uniqueConstraint: {
          githubId: "This repository is already added",
          url: "Repository with this URL already exists",
        },
      });
    }
  },
};
