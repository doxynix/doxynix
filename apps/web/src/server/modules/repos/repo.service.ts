import { Status, Visibility } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";
import { getRepoInfo } from "@/server/core/github/github-api";
import { GitHubAuthRequiredError, parseUrl } from "@/server/core/github/github-provider";
import { handlePrismaError, toOctokitTrpcError } from "@/server/utils/handle-error";
import { clampPage, getPaginationMeta } from "@/server/utils/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";

import { repoMapper } from "./repo.mapper";
import type { RepoFiltersInput } from "./repo.schemas";

function buildRepoSearchClause(term: string): Prisma.RepoWhereInput {
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { owner: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
}

function mergeClauses(clauses: Prisma.RepoWhereInput[]): Prisma.RepoWhereInput {
  const defined = clauses.filter((clause) => Object.keys(clause).length > 0);

  if (defined.length <= 1) {
    return defined[0] ?? {};
  }

  return { AND: defined };
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
      searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => buildRepoSearchClause(term)),
          }
        : {};

    const searchFilter: Prisma.RepoWhereInput =
      normalizedSearch != null && searchTerms.length > 0
        ? normalizedSearch === searchTerms[0] && searchTerms.length === 1
          ? rawSearchFilter
          : { OR: [rawSearchFilter, tokenSearchFilter] }
        : rawSearchFilter;

    return mergeClauses([
      filters.visibility != null ? { visibility: filters.visibility } : {},
      normalizedOwner != null && normalizedOwner.length > 0
        ? { owner: { equals: normalizedOwner, mode: "insensitive" } }
        : {},
      statusFilter,
      searchFilter,
    ]);
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
      throw toOctokitTrpcError(error) ?? error;
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
    const page = clampPage(cursor);
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

    return repoMapper.toPaginatedList(items, meta);
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

    if (repo == null) {
      return null;
    }

    return { ...repoMapper.toPublicFields(repo), status: repoMapper.latestStatus(repo.analyses) };
  },
  async getByOwner(db: DbClient, owner: string) {
    const repo = await db.repo.findFirst({
      where: {
        owner: { equals: owner, mode: "insensitive" },
      },
    });

    if (repo == null) {
      return null;
    }

    return { ...repoMapper.toPublicFields(repo), status: Status.NEW };
  },

  async getSlim(db: DbClient, input: RepoFiltersInput) {
    const { cursor, limit, owner, search, status, visibility } = input;
    const page = clampPage(cursor);
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause({ owner, search, status, visibility });

    const items = await db.repo.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        name: true,
        owner: true,
        ownerAvatarUrl: true,
        publicId: true,
      },
      skip,
      take: limit,
      where,
    });

    const totalCount = await db.repo.count({ where });

    return {
      items: items.map((item) => repoMapper.toSlim(item)),
      meta: {
        nextCursor: skip + items.length < totalCount ? page + 1 : null,
        totalCount,
      },
    };
  },
};
