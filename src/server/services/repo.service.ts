import { Prisma, Status, Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { handlePrismaError } from "@/server/utils/handle-prisma-error";
import { githubService } from "./github.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;
interface OctokitError {
  status: number;
  message: string;
}

function isOctokitError(error: unknown): error is OctokitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  );
}

export const repoService = {
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

    const { owner, name } = repoInfo;

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
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        uniqueConstraint: {
          githubId: "This repository is already added",
          url: "Repository with this URL already exists",
        },
        defaultConflict: "You have already added this repository",
      });
    }
  },

  buildWhereClause(filters: {
    search?: string;
    visibility?: Visibility;
    status?: Status;
    owner?: string;
  }): Prisma.RepoWhereInput {
    const { search, visibility, status, owner } = filters;
    const searchTerms = search != null ? search.trim().split(/\s+/) : [];

    const statusFilter: Prisma.RepoWhereInput =
      status !== undefined
        ? status === Status.NEW
          ? { OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }] }
          : { analyses: { some: { status } } }
        : {};

    const visibilityFilter = visibility ? { visibility } : {};

    const ownerFilter: Prisma.RepoWhereInput =
      owner !== undefined ? { owner: { equals: owner, mode: "insensitive" } } : {};

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
};
