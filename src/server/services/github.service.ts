import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { Visibility } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import parseGithubUrl from "parse-github-url";

import type { DbClient } from "@/shared/api/db/db";
import { SYSTEM_TOKEN } from "@/shared/constants/env.server";
import { logger } from "@/shared/lib/logger";
import type { RepoItemFields } from "@/shared/types/repo-item";

import { FileClassifier } from "../utils/file-classifier";

const MyOctokit = Octokit.plugin(retry, throttling, paginateRest);
type SearchRepoItem =
  RestEndpointMethodTypes["search"]["repos"]["response"]["data"]["items"][number];
type ListRepoItem =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];

type GitHubRepoResponse = SearchRepoItem | ListRepoItem;

export const githubService = {
  async getClientForUser(prisma: DbClient, userId: number) {
    const account = await prisma.account.findFirst({
      where: { provider: "github", userId },
    });

    const token = account?.access_token ?? SYSTEM_TOKEN;

    if (token == null) {
      logger.error({ msg: "Token not found in DB and no system token configured", userId });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "GitHub account not connected. Please link your GitHub account in settings.",
      });
    }

    return new MyOctokit({
      auth: token,
      log: {
        debug: (msg) => logger.debug({ msg }),
        error: (msg) => logger.error({ msg }),
        info: (msg) => logger.info({ msg }),
        warn: (msg) => logger.warn({ msg }),
      },

      retry: {
        doNotRetry: [429],
      },

      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(
            `Rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
          );
          return retryCount < 2;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          octokit.log.warn(
            `Secondary rate limit hit: ${options.method} ${options.url}. Retrying after ${retryAfter}s.`
          );
          return true;
        },
      },

      userAgent: "Doxynix/1.0.0",
    });
  },

  async getMyRepos(prisma: DbClient, userId: number, limit?: number): Promise<RepoItemFields[]> {
    try {
      const octokit = await this.getClientForUser(prisma, userId);

      if (limit != null) {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          direction: "desc",
          per_page: limit,
          sort: "updated",
          visibility: "all",
        });
        return this.mapRepos(data);
      }

      const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        direction: "desc",
        per_page: 100,
        sort: "updated",
        visibility: "all",
      });

      return this.mapRepos(repos);
    } catch (error) {
      logger.error({ error, msg: "Error fetching repositories", userId });
      return [];
    }
  },

  async getRepoInfo(prisma: DbClient, userId: number, owner: string, name: string) {
    const octokit = await this.getClientForUser(prisma, userId);
    const { data } = await octokit.repos.get({ owner, repo: name });

    return data;
  },

  async getRepoTree(
    prisma: DbClient,
    userId: number,
    owner: string,
    name: string,
    branch?: string
  ) {
    const octokit = await this.getClientForUser(prisma, userId);

    const { data: repoData } = await octokit.repos.get({ owner, repo: name });
    const treeSha = branch ?? repoData.default_branch;

    const { data } = await octokit.git.getTree({
      owner,
      recursive: "1",
      repo: name,
      tree_sha: treeSha,
    });

    return data.tree
      .filter((item) => {
        if (!item.path) return false;
        if (item.type !== "blob") return false;

        return !FileClassifier.isIgnored(item.path);
      })
      .map((item) => ({
        path: item.path!,
        sha: item.sha,
        type: item.type,
      }));
  },

  mapRepos(data: GitHubRepoResponse[]): RepoItemFields[] {
    return data.map((repo) => ({
      description: repo.description ?? null,
      fullName: repo.full_name,
      language: repo.language ?? null,
      stars: repo.stargazers_count ?? 0,
      updatedAt: repo.updated_at ?? new Date().toISOString(),
      visibility: repo.private === true ? Visibility.PRIVATE : Visibility.PUBLIC,
    }));
  },

  parseUrl(input: string) {
    if (!input?.trim()) throw new Error("Field cannot be empty");

    const parsed = parseGithubUrl(input);

    if (
      parsed == null ||
      parsed.owner == null ||
      parsed.owner.trim().length === 0 ||
      parsed.name == null ||
      parsed.name.trim().length === 0
    ) {
      throw new Error("Invalid format. Enter 'owner/repo' or repository URL");
    }

    return { name: parsed.name, owner: parsed.owner };
  },
  async searchRepos(
    prisma: DbClient,
    userId: number,
    query: string,
    limit: number | undefined
  ): Promise<RepoItemFields[]> {
    if (query.length < 2 || query.length > 256) return [];

    const octokit = await this.getClientForUser(prisma, userId);

    try {
      const { data } = await octokit.search.repos({
        per_page: limit ?? 10,
        q: query,
      });

      return data.items.map((repo) => ({
        description: repo.description,
        fullName: repo.full_name,
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        visibility: repo.private ? Visibility.PRIVATE : Visibility.PUBLIC,
      }));
    } catch (error) {
      logger.error({ error, msg: "GitHub search error" });
      return [];
    }
  },
};
