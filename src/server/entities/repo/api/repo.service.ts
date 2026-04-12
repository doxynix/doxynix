import { Status, Visibility, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { RepoFiltersInput } from "@/server/api/contracts";
import type { DbClient } from "@/server/shared/infrastructure/db";
import { getRepoInfo } from "@/server/shared/infrastructure/github/github-api";
import {
  GitHubAuthRequiredError,
  parseUrl,
} from "@/server/shared/infrastructure/github/github-provider";
import { handlePrismaError, isOctokitError } from "@/server/shared/lib/handle-error";
import { getPaginationMeta } from "@/server/shared/lib/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/shared/lib/search";

import { repoPresenter, type RepoWithAnalyses } from "./repo.presenter";

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
  buildWhereClause(filters: Partial<RepoFiltersInput>): Prisma.RepoWhereInput {
    const normalizedOwner = filters.owner?.trim();
    const normalizedSearch = normalizeSearchInput(filters.search ?? undefined);
    const searchTerms = tokenizeSearchInput(filters.search ?? undefined);

    const statusFilter: Prisma.RepoWhereInput =
      filters.status == null
        ? {}
        : filters.status === Status.NEW
          ? { OR: [{ analyses: { none: {} } }, { analyses: { some: { status: Status.NEW } } }] }
          : { analyses: { some: { status: filters.status as Status } } };

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
      ...(filters.visibility != null && { visibility: filters.visibility as Visibility }),
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
      repoInfo = parseUrl(url);
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid URL. Use 'owner/repo' format or 'https://github.com/...'",
      });
    }

    const { name, owner } = repoInfo;

    let githubData;
    try {
      githubData = await getRepoInfo(db, userId, owner, name);
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
            code: "FORBIDDEN",
            message: "GitHub denied access to this repository",
          });
        }
        if (error.status === 429) {
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
          visibility: Boolean(githubData.private) ? Visibility.PRIVATE : Visibility.PUBLIC,
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

  async delete(db: DbClient, id: string) {
    try {
      await db.repo.delete({
        where: { publicId: id },
      });

      return { message: "Repository deleted", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Repository not found" });
    }
  },

  async deleteAll(db: DbClient) {
    try {
      const deletedRepoCount = await db.repo.deleteMany();
      if (deletedRepoCount.count === 0) {
        return { message: "No repositories found", success: false };
      }

      return { message: "All repositories have been deleted", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Repositories not found" });
    }
  },

  async deleteByOwner(db: DbClient, owner: string) {
    const result = await db.repo.deleteMany({
      where: {
        owner: { equals: owner, mode: "insensitive" },
      },
    });

    return {
      count: result.count,
      message: `Deleted ${result.count} repositories for ${owner}`,
      success: true,
    };
  },

  async getAll(db: DbClient, input: RepoFiltersInput) {
    const { cursor, limit, owner, search, sortBy, sortOrder, status, visibility } = input;
    const page = Math.min(Math.max(1, cursor ?? 1), 1_000_000);
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause({ owner, search, status, visibility });
    const contextWhere: Prisma.RepoWhereInput =
      owner == null ? {} : { owner: { equals: owner, mode: "insensitive" } };

    const [items, totalCount, filteredCount] = await Promise.all([
      db.repo.findMany({
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
        skip,
        take: limit,
        where,
      }),
      db.repo.count({ where: contextWhere }),
      db.repo.count({ where }),
    ]);

    const meta = getPaginationMeta({
      filteredCount,
      limit,
      page,
      search: search ?? undefined,
      totalCount,
    });

    return repoPresenter.toPaginatedList(items as RepoWithAnalyses[], meta);
  },

  async getByName(db: DbClient, owner: string, name: string) {
    const repo = await db.repo.findFirst({
      include: {
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      where: {
        name: { equals: name, mode: "insensitive" },
        owner: { equals: owner, mode: "insensitive" },
      },
    });

    if (repo == null) return null;

    return {
      ...repo,
      id: repo.publicId,
      message: "Repository found",
      status: repo.analyses[0]?.status ?? Status.NEW,
    };
  },
  async getByOwner(db: DbClient, owner: string) {
    const repo = await db.repo.findFirst({
      where: {
        owner: { equals: owner, mode: "insensitive" },
      },
    });

    if (repo == null) return null;

    return {
      ...repo,
      id: repo.publicId,
      message: "Owner found",
    };
  },

  async getSlim(db: DbClient, limit?: number) {
    const repos = await db.repo.findMany({
      orderBy: { name: "asc" },
      select: { name: true, owner: true, publicId: true },
      ...(limit != null && { take: Math.floor(limit) }),
    });

    return repos.map((r) => ({ id: r.publicId, name: r.name, owner: r.owner }));
  },
};
