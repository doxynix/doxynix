import { MAX_PAGE, Status, Visibility } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";
import { getRepoInfo } from "@/server/core/github/github-api";
import { GitHubAuthRequiredError, parseUrl } from "@/server/core/github/github-client";
import { realtimeService } from "@/server/core/realtime";
import { handlePrismaError, toOctokitTrpcError } from "@/server/utils/handle-error";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  orderWithTiebreak,
} from "@/server/utils/pagination";
import { normalizeSearchInput, tokenizeSearchInput } from "@/server/utils/search";

import { repoMapper } from "./repo.mapper";
import type { RepoFiltersInput, RepoSlimFiltersInput } from "./repo.schemas";

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
      buildDateRangeWhere(filters, "updatedAt"),
      statusFilter,
      searchFilter,
    ]);
  },

  async createRepo(db: DbClient, userId: string, url: string) {
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
      const repo = await db.repo.create({
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

      void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.repoUpdated, {});

      return repo;
    } catch (error) {
      handlePrismaError(error, {
        defaultConflict: "You have already added this repository",
        uniqueConstraint: {
          githubId: "This repository is already added",
        },
      });
    }
  },

  async delete(db: DbClient, id: string, userId: string) {
    try {
      await db.repo.delete({
        where: { id, userId },
      });

      void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.repoUpdated, {});

      return { success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Repository not found" });
    }
  },

  async deleteAll(db: DbClient, userId: string) {
    try {
      await db.repo.deleteMany({ where: { userId } });

      void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.repoUpdated, {});

      return { success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Repositories not found" });
    }
  },

  async deleteByOwner(db: DbClient, owner: string, userId: string) {
    const result = await db.repo.deleteMany({
      where: {
        owner: { equals: owner, mode: "insensitive" },
        userId,
      },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.repoUpdated, {});

    return { count: result.count, success: true };
  },

  async getAll(db: DbClient, input: RepoFiltersInput, userId: string) {
    const { limit, owner, page, search, sortBy, sortOrder, status, visibility } = input;

    const where = { userId, ...this.buildWhereClause({ owner, search, status, visibility }) };
    const contextWhere: Prisma.RepoWhereInput =
      owner == null ? {} : { owner: { equals: owner, mode: "insensitive" } };

    const orderBy = orderWithTiebreak(sortBy, sortOrder);

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.RepoWhereInput) =>
      cappedCount(
        (take) => db.repo.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered:
        owner != null && Object.keys(where).length > 0 ? () => countMatching(contextWhere) : null,
      fetchItems: ({ skip, take }) =>
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
          orderBy,
          skip,
          take,
          where,
        }),
      input: { limit, page, ...(search != null ? { search } : {}) },
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

  async getSlim(db: DbClient, input: RepoSlimFiltersInput, userId: string) {
    const { cursor, limit, owner, search, status, visibility } = input;

    const where = { userId, ...this.buildWhereClause({ owner, search, status, visibility }) };

    const items = await db.repo.findMany({
      cursor: cursor != null ? { id: cursor } : undefined,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        owner: true,
        ownerAvatarUrl: true,
      },
      take: limit + 1,
      where,
    });

    const hasNextPage = items.length > limit;
    if (hasNextPage) {
      items.pop();
    }

    return {
      items: items.map((item) => repoMapper.toSlim(item)),
      meta: {
        hasNextPage,
        nextCursor: items.at(-1)?.id,
      },
    };
  },
};
