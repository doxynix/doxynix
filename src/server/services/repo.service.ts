import { Status, Visibility, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "../db/db";
import { handlePrismaError, isOctokitError } from "../utils/handle-error";
import { normalizeSearchInput, tokenizeSearchInput } from "../utils/search";
import { GitHubAuthRequiredError, githubService } from "./github.service";

type RepoSearchFilters = {
  owner?: string;
  search?: string;
  status?: Status;
  visibility?: Visibility;
};

function buildRepoSearchClause(term: string): Prisma.RepoWhereInput {
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { owner: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
}

export const repoService = {
  buildWhereClause(filters: RepoSearchFilters): Prisma.RepoWhereInput {
    const normalizedOwner = filters.owner?.trim();
    const normalizedSearch = normalizeSearchInput(filters.search);
    const searchTerms = tokenizeSearchInput(filters.search);

    const statusFilter: Prisma.RepoWhereInput =
      filters.status == null
        ? {}
        : filters.status === Status.NEW
          ? { OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }] }
          : { analyses: { some: { status: filters.status } } };

    const rawSearchFilter: Prisma.RepoWhereInput =
      normalizedSearch != null ? buildRepoSearchClause(normalizedSearch) : {};

    const tokenSearchFilter: Prisma.RepoWhereInput =
      searchTerms.length > 1
        ? {
            AND: searchTerms.map((term) => buildRepoSearchClause(term)),
          }
        : {};

    const searchFilter: Prisma.RepoWhereInput =
      normalizedSearch != null && searchTerms.length > 1
        ? { OR: [rawSearchFilter, tokenSearchFilter] }
        : rawSearchFilter;

    return {
      ...(filters.visibility != null && { visibility: filters.visibility }),
      ...(normalizedOwner != null &&
        normalizedOwner.length > 0 && {
          owner: { equals: normalizedOwner, mode: "insensitive" },
        }),
      ...statusFilter,
      ...searchFilter,
    };
  },

  async createRepo(db: DbClient, userId: number, url: string) {
    let repoInfo;
    try {
      repoInfo = githubService.parseUrl(url) as { name: string; owner: string };
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid URL. Use 'owner/repo' format or 'https://github.com/...'",
      });
    }

    const { name, owner } = repoInfo;

    let githubData;
    try {
      githubData = await githubService.getRepoInfo(db, userId, owner, name);
    } catch (error) {
      if (error instanceof GitHubAuthRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Connect your GitHub account or install the app to access this repository.",
        });
      }
      if (isOctokitError(error)) {
        if (error.status === 401) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub token expired",
          });
        }
        if (error.status === 404) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found on GitHub",
          });
        }
        if (error.status === 403) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "GitHub API limit exceeded",
          });
        }
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
        },
      });
    }
  },
};
